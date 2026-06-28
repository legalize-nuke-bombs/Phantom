package com.example.phantom.crypto.withdrawal;

import com.example.phantom.crypto.*;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.topic.Topic;
import com.example.phantom.topic.globaltopic.GlobalTopicService;
import com.example.phantom.owner.masterwallet.MasterWalletSetting;
import com.example.phantom.owner.masterwallet.MasterWalletSettingRepository;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Service
@Slf4j
public class WithdrawalService {

    private final WalletService walletService;
    private final WithdrawalRepository withdrawalRepository;
    private final MasterWalletSettingRepository masterWalletSettingRepository;
    private final RefundRepository refundRepository;
    private final CoinProviderRegistry coinProviderRegistry;
    private final NotificationPublishService notificationPublishService;
    private final GlobalTopicService globalTopicService;
    private final RateLimitService rateLimitService;
    private final ConcurrentHashMap<CoinType, ReentrantLock> masterLocks = new ConcurrentHashMap<>();

    public WithdrawalService(
            WalletService walletService,
            WithdrawalRepository withdrawalRepository,
            RefundRepository refundRepository,
            MasterWalletSettingRepository masterWalletSettingRepository,
            CoinProviderRegistry coinProviderRegistry,
            NotificationPublishService notificationPublishService,
            GlobalTopicService globalTopicService,
            RateLimitService rateLimitService
    ) {
        this.walletService = walletService;
        this.withdrawalRepository = withdrawalRepository;
        this.refundRepository = refundRepository;
        this.masterWalletSettingRepository = masterWalletSettingRepository;
        this.coinProviderRegistry = coinProviderRegistry;
        this.notificationPublishService = notificationPublishService;
        this.globalTopicService = globalTopicService;
        this.rateLimitService = rateLimitService;
    }

    public ReentrantLock masterLock(CoinType coin) {
        return masterLocks.computeIfAbsent(coin, k -> new ReentrantLock());
    }

    public Withdrawal prepareWithdrawal(User user, CoinType coin, String receiver, BigDecimal amount) {
        CoinProvider provider = coinProviderRegistry.get(coin);
        provider.validateAddress(receiver);

        if (amount.compareTo(provider.getWithdrawalMinAmount()) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_WITHDRAWAL);
        }

        MasterWalletSetting masterWalletSetting = masterWalletSettingRepository.findByCoinType(coin)
                .orElseThrow(() -> new ApiException(ErrorCode.WITHDRAWAL_UNAVAILABLE));
        String masterAddress = masterWalletSetting.getAddress();
        String masterPrivateKey = masterWalletSetting.getPrivateKey();
        if (masterAddress == null || masterPrivateKey == null) {
            log.info("withdrawal rejected: master wallet has not been set");
            throw new ApiException(ErrorCode.WITHDRAWAL_UNAVAILABLE);
        }

        BigDecimal toSend = amount.multiply(provider.getWithdrawalUserEdge());

        try {
            if (provider.getBalanceUsd(masterAddress).compareTo(toSend) < 0) {
                log.info("withdrawal rejected: master wallet insufficient balance");
                throw new ApiException(ErrorCode.MASTER_WALLET_DRAINED);
            }
            CoinProvider.PreparedTransfer prepared = provider.prepare(masterPrivateKey, masterAddress, receiver, toSend);

            Withdrawal withdrawal = new Withdrawal();
            withdrawal.setUser(user);
            withdrawal.setCoin(coin);
            withdrawal.setTimestamp(Instant.now().getEpochSecond());
            withdrawal.setReceiver(receiver);
            withdrawal.setAmount(amount);
            withdrawal.setStatus(TransferStatus.SENDING);
            withdrawal.setHash(prepared.msgHash());
            withdrawal.setBoc(prepared.boc());
            return withdrawal;
        }
        catch (CryptoException e) {
            log.warn("withdrawal prepare failed", e);
            throw new ApiException(ErrorCode.WITHDRAWAL_UNAVAILABLE);
        }
    }

    @Transactional
    public Withdrawal reserve(Withdrawal withdrawal) {
        Wallet wallet = walletService.lock(withdrawal.getUser().getId());

        if (wallet.getBalanceCached().compareTo(withdrawal.getAmount()) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }

        walletService.addChange(wallet, withdrawal.getAmount().negate());
        return withdrawalRepository.save(withdrawal);
    }

    public void submit(Withdrawal withdrawal) {
        CoinProvider provider = coinProviderRegistry.get(withdrawal.getCoin());
        try {
            String serverHash = provider.submit(withdrawal.getBoc());
            if (!serverHash.equals(withdrawal.getHash())) {
                log.warn("withdrawal {}: local msgHash {} != toncenter hash {} - verify hash encoding", withdrawal.getId(), withdrawal.getHash(), serverHash);
            }
        }
        catch (CryptoException e) {
            log.warn("withdrawal {} submit failed, will reconcile on status check", withdrawal.getId(), e);
        }
    }

    public List<Withdrawal> checkPendingStatuses(Long userId, CoinType coin) {
        List<Withdrawal> sending = withdrawalRepository.findByUserIdAndCoinAndStatus(userId, coin, TransferStatus.SENDING);

        for (Withdrawal withdrawal : sending) {
            CoinProvider provider = coinProviderRegistry.get(withdrawal.getCoin());
            try {
                TransferStatus status = provider.checkTransferStatus(withdrawal.getHash(), withdrawal.getTimestamp());
                if (status != TransferStatus.PENDING) {
                    withdrawal.setStatus(status);
                }
            }
            catch (CryptoException e) {
                log.warn("failed to check status for withdrawal {}, leaving as SENDING", withdrawal.getId());
            }
        }

        return sending;
    }

    public List<Withdrawal> getWithdrawals(Long userId, CoinType coin, Long before, Integer limit) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);
        return withdrawalRepository.findByUserIdAndCoinWithUsers(userId, coin, before, PageRequest.of(0, limit));
    }

    @Transactional
    public void applyCheckedStatuses(Long userId, List<Withdrawal> checked) {
        Wallet wallet = walletService.lock(userId);

        Topic ownersTopic = globalTopicService.findOwners();
        for (Withdrawal w : checked) {
            log.info("applying withdrawal {} status={}", w.getId(), w.getStatus());

            if (w.getStatus() == TransferStatus.REJECTED && refundRepository.insertIfNotExists(w.getId()) == 1) {
                walletService.addChange(wallet, w.getAmount());
                notificationPublishService.createTopicNotification(ownersTopic, NotificationType.WITHDRAWAL_FAILED, new WithdrawalRepresentation(w));
                log.info("withdrawal {} refund {}", w.getId(), w.getAmount());
            }
        }

        withdrawalRepository.saveAll(checked);
    }
}
