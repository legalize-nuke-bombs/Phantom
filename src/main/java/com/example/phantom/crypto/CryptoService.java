package com.example.phantom.crypto;

import com.example.phantom.crypto.deposit.Deposit;
import com.example.phantom.crypto.deposit.DepositRepresentation;
import com.example.phantom.crypto.deposit.DepositService;
import com.example.phantom.crypto.withdrawal.WithdrawRequest;
import com.example.phantom.crypto.withdrawal.Withdrawal;
import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import com.example.phantom.crypto.withdrawal.WithdrawalService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.topic.globaltopic.GlobalTopicService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Service
@Slf4j
public class CryptoService {

    private final UserRepository userRepository;
    private final CryptoWalletRepository cryptoWalletRepository;
    private final DepositService depositService;
    private final WithdrawalService withdrawalService;
    private final RateLimitService rateLimitService;
    private final NotificationPublishService notificationPublishService;
    private final GlobalTopicService globalTopicService;

    private final Map<String, Long> cacheMap;
    private static final int CACHE_DURATION = 5;

    public CryptoService(
            UserRepository userRepository,
            CryptoWalletRepository cryptoWalletRepository,
            DepositService depositService,
            WithdrawalService withdrawalService,
            RateLimitService rateLimitService,
            NotificationPublishService notificationPublishService,
            GlobalTopicService globalTopicService
    ) {
        this.userRepository = userRepository;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.depositService = depositService;
        this.withdrawalService = withdrawalService;
        this.rateLimitService = rateLimitService;
        this.notificationPublishService = notificationPublishService;
        this.globalTopicService = globalTopicService;
        this.cacheMap = new ConcurrentHashMap<>();
    }

    public CryptoWalletRepresentation getWallet(Long userId, CoinType coin) {
        CryptoWallet wallet = cryptoWalletRepository.findByUserIdAndCoin(userId, coin).orElseThrow(() -> new ApiException(ErrorCode.CRYPTO_WALLET_NOT_FOUND));
        return new CryptoWalletRepresentation(wallet);
    }

    public List<DepositRepresentation> checkDeposits(Long userId, CoinType coin) {
        if (cacheMap.putIfAbsent(userId + ":checkDeposits:" + coin.name(), Instant.now().getEpochSecond()) != null) {
            return List.of();
        }

        log.info("checking {} deposits for user {} ...", coin, userId);

        User user = getUser(userId);
        rateLimit(user);

        List<Deposit> deposits = depositService.fetchDeposits(user, coin);
        try {
            depositService.applyDeposits(user, deposits);
        }
        catch (DepositService.DepositsAreAlreadyAppliedException e) {
            return List.of();
        }

        log.info("applied {} {} deposits for user {}", deposits.size(), coin, userId);
        return deposits.stream().map(DepositRepresentation::new).toList();
    }

    public List<DepositRepresentation> getDeposits(Long userId, CoinType coin, Long before, Integer limit) {
        return depositService.getDeposits(userId, coin, before, limit).stream().map(DepositRepresentation::new).toList();
    }

    public WithdrawalRepresentation withdraw(Long userId, CoinType coin, WithdrawRequest request) {
        String address = request.getAddress();
        BigDecimal amount = request.getAmount();

        log.info("withdrawing {} to {} {} for {} ...", amount, coin, address, userId);

        User user = getUser(userId);
        rateLimit(user);

        ReentrantLock masterLock = withdrawalService.masterLock(coin);
        masterLock.lock();
        Withdrawal withdrawal;
        try {
            withdrawal = withdrawalService.prepareWithdrawal(user, coin, address, amount);
            withdrawal = withdrawalService.reserve(withdrawal);
            withdrawalService.submit(withdrawal);
        }
        finally {
            masterLock.unlock();
        }

        WithdrawalRepresentation representation = new WithdrawalRepresentation(withdrawal);
        log.info("withdrawal request created {}, {}, {}, {}", amount, coin, address, user.getId());
        notificationPublishService.createTopicNotification(globalTopicService.findOwners(), NotificationType.NEW_WITHDRAWAL, representation);
        return representation;
    }

    public List<WithdrawalRepresentation> checkPendingWithdrawals(Long userId, CoinType coin) {
        if (cacheMap.putIfAbsent(userId + ":checkPendingWithdrawals:" + coin.name(), Instant.now().getEpochSecond()) != null) {
            return List.of();
        }

        log.info("checking {} pending withdrawals for {} ...", coin, userId);

        User user = getUser(userId);
        rateLimit(user);

        List<Withdrawal> checked = withdrawalService.checkPendingStatuses(userId, coin);
        withdrawalService.applyCheckedStatuses(userId, checked);

        log.info("found {} {} pending withdrawals for {}", checked.size(), coin, user.getId());
        return checked.stream().map(WithdrawalRepresentation::new).toList();
    }

    public List<WithdrawalRepresentation> getWithdrawals(Long userId, CoinType coin, Long before, Integer limit) {
        return withdrawalService.getWithdrawals(userId, coin, before, limit).stream().map(WithdrawalRepresentation::new).toList();
    }

    @Scheduled(fixedDelay = 1 * 1000)
    public void clearExpiredCache() {
        cacheMap.entrySet().removeIf(t -> (Instant.now().getEpochSecond() - t.getValue() > CACHE_DURATION));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private void rateLimit(User user) {
        rateLimitService.startAction(user.getId(), RateLimitAction.CRYPTO, 1L);
    }
}
