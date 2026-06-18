package com.example.phantom.crypto.withdrawal;

import com.example.phantom.crypto.*;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.notification.topic.Topic;
import com.example.phantom.notification.topic.globaltopic.GlobalTopicService;
import com.example.phantom.owner.masterwallet.MasterWalletSetting;
import com.example.phantom.owner.masterwallet.MasterWalletSettingRepository;
import com.example.phantom.user.User;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

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

    public WithdrawalService(
            WalletService walletService,
            WithdrawalRepository withdrawalRepository,
            RefundRepository refundRepository,
            MasterWalletSettingRepository masterWalletSettingRepository,
            CoinProviderRegistry coinProviderRegistry,
            NotificationPublishService notificationPublishService,
            GlobalTopicService globalTopicService
    ) {
        this.walletService = walletService;
        this.withdrawalRepository = withdrawalRepository;
        this.refundRepository = refundRepository;
        this.masterWalletSettingRepository = masterWalletSettingRepository;
        this.coinProviderRegistry = coinProviderRegistry;
        this.notificationPublishService = notificationPublishService;
        this.globalTopicService = globalTopicService;
    }

    @Transactional
    public Withdrawal reserveFinances(User user, CoinType coin, String receiver, BigDecimal amount) {
        CoinProvider provider = coinProviderRegistry.get(coin);
        provider.validateAddress(receiver);

        if (amount.compareTo(provider.getWithdrawalMinAmount()) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_WITHDRAWAL);
        }

        Wallet wallet = walletService.lock(user.getId());

        if (wallet.getBalanceCached().compareTo(amount) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }

        walletService.addChange(wallet, amount.negate());

        Withdrawal withdrawal = new Withdrawal();
        withdrawal.setUser(user);
        withdrawal.setCoin(coin);
        withdrawal.setTimestamp(Instant.now().getEpochSecond());
        withdrawal.setReceiver(receiver);
        withdrawal.setAmount(amount);
        withdrawal.setStatus(TransferStatus.PENDING);
        return withdrawalRepository.save(withdrawal);
    }

    public Withdrawal send(Withdrawal withdrawal) {
        CoinProvider provider = coinProviderRegistry.get(withdrawal.getCoin());

        MasterWalletSetting masterWalletSetting = masterWalletSettingRepository.findByCoinType(withdrawal.getCoin()).orElseThrow(() -> new ApiException(ErrorCode.WITHDRAWAL_UNAVAILABLE));
        String masterAddress = masterWalletSetting.getAddress();
        String masterPrivateKey = masterWalletSetting.getPrivateKey();
        if (masterAddress == null || masterPrivateKey == null) {
            log.info("withdrawal rejected: master wallet has not been set");
            throw new ApiException(ErrorCode.WITHDRAWAL_UNAVAILABLE);
        }

        BigDecimal toSend = withdrawal.getAmount().multiply(provider.getWithdrawalUserEdge());

        try {
            if (provider.getBalanceUsd(masterAddress).compareTo(toSend) < 0) {
                log.info("withdrawal rejected: master wallet insufficient balance");
                throw new ApiException(ErrorCode.MASTER_WALLET_DRAINED);
            }

            String hash = provider.send(
                    masterPrivateKey,
                    masterAddress,
                    withdrawal.getReceiver(),
                    toSend);
            withdrawal.setHash(hash);
        }
        catch (CryptoException e) {
            log.warn("withdrawal failed", e);
            throw new ApiException(ErrorCode.WITHDRAWAL_UNAVAILABLE);
        }

        return withdrawalRepository.save(withdrawal);
    }

    public List<Withdrawal> checkPendingStatuses(Long userId) {
        List<Withdrawal> pending = withdrawalRepository.findByUserIdAndStatus(userId, TransferStatus.PENDING);

        for (Withdrawal withdrawal : pending) {
            if (withdrawal.getHash() == null) {
                withdrawal.setStatus(TransferStatus.REJECTED);
                continue;
            }

            CoinProvider provider = coinProviderRegistry.get(withdrawal.getCoin());
            try {
                TransferStatus status = provider.checkTransferStatus(
                        withdrawal.getHash(),
                        withdrawal.getTimestamp()
                );
                withdrawal.setStatus(status);
            }
            catch (CryptoException e) {
                log.warn("failed to check status for withdrawal {}, leaving as PENDING", withdrawal.getId());
            }
        }

        return pending;
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
