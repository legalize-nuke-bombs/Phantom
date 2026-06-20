package com.example.phantom.crypto.deposit;

import com.example.phantom.crypto.*;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@Slf4j
public class DepositService {

    private static final int TX_FETCH_LIMIT = 20;
    public static final BigDecimal MIN_APPLY_AMOUNT = new BigDecimal("0.01");

    private final WalletService walletService;
    private final CryptoWalletRepository cryptoWalletRepository;
    private final DepositRepository depositRepository;
    private final CoinProviderRegistry coinProviderRegistry;
    private final RateLimitService rateLimitService;

    public DepositService(
            WalletService walletService,
            CryptoWalletRepository cryptoWalletRepository,
            DepositRepository depositRepository,
            CoinProviderRegistry coinProviderRegistry,
            RateLimitService rateLimitService
    ) {
        this.walletService = walletService;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.depositRepository = depositRepository;
        this.coinProviderRegistry = coinProviderRegistry;
        this.rateLimitService = rateLimitService;
    }

    public List<Deposit> fetchDeposits(User user, CoinType coin) {
        CoinProvider provider = coinProviderRegistry.get(coin);
        CryptoWallet wallet = cryptoWalletRepository.findByUserIdAndCoin(user.getId(), coin)
                .orElseThrow(() -> new ApiException(ErrorCode.CRYPTO_WALLET_NOT_FOUND));

        List<CoinProvider.IncomingTransfer> transfers;
        try {
            transfers = provider.getIncomingTransfers(wallet.getAddress(), TX_FETCH_LIMIT).stream().filter(k -> (k.amountUsd().compareTo(MIN_APPLY_AMOUNT) >= 0)).toList();
        }
        catch (CryptoException e) {
            throw new ApiException(ErrorCode.UPSTREAM_ERROR);
        }

        if (transfers.isEmpty()) {
            return List.of();
        }

        List<String> txHashes = transfers.stream()
                .map(CoinProvider.IncomingTransfer::txHash)
                .toList();

        Set<String> existingHashes = new HashSet<>(depositRepository.findExistingHashes(txHashes));

        List<CoinProvider.IncomingTransfer> newTransfers = transfers.stream()
                .filter(tx -> !existingHashes.contains(tx.txHash()))
                .toList();

        if (newTransfers.isEmpty()) {
            return List.of();
        }

        long now = Instant.now().getEpochSecond();
        List<Deposit> deposits = new ArrayList<>();

        for (CoinProvider.IncomingTransfer tx : newTransfers) {
            Deposit deposit = new Deposit();
            deposit.setUser(user);
            deposit.setCoin(coin);
            deposit.setTxHash(tx.txHash());
            deposit.setAmount(tx.amountUsd());
            deposit.setTimestamp(now);
            deposits.add(deposit);
        }

        return deposits;
    }

    public List<Deposit> getDeposits(Long userId, CoinType coin, Long before, Integer limit) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);
        return depositRepository.findByUserIdAndCoinWithUsers(userId, coin, before, PageRequest.of(0, limit));
    }

    public static class DepositsAreAlreadyAppliedException extends Exception {
        public DepositsAreAlreadyAppliedException() {}
    }

    @Transactional
    public void applyDeposits(User user, List<Deposit> deposits) throws DepositsAreAlreadyAppliedException {
        try {
            depositRepository.saveAll(deposits);
        }
        catch (DataIntegrityViolationException e) {
            log.warn("thread condition happened during applying deposits");
            throw new DepositsAreAlreadyAppliedException();
        }

        Wallet wallet = walletService.lock(user.getId());
        for (Deposit deposit : deposits) {
            walletService.addChange(wallet, deposit.getAmount());
        }
    }
}
