package com.example.phantom.crypto.deposit;

import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CoinProviderRegistry;
import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoWallet;
import com.example.phantom.crypto.CryptoWalletRepository;
import com.example.phantom.exception.BadGatewayException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.user.User;
import com.example.phantom.wallet.WalletService;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
public class DepositService {

    private static final int TX_FETCH_LIMIT = 20;

    private final WalletService walletService;
    private final CryptoWalletRepository cryptoWalletRepository;
    private final DepositRepository depositRepository;
    private final CoinProviderRegistry coinProviderRegistry;

    public DepositService(
            WalletService walletService,
            CryptoWalletRepository cryptoWalletRepository,
            DepositRepository depositRepository,
            CoinProviderRegistry coinProviderRegistry
    ) {
        this.walletService = walletService;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.depositRepository = depositRepository;
        this.coinProviderRegistry = coinProviderRegistry;
    }

    public List<Deposit> fetchDeposits(User user, String coin) {
        CoinProvider provider = coinProviderRegistry.get(coin);
        CryptoWallet wallet = cryptoWalletRepository.findByUserIdAndCoin(user.getId(), coin)
                .orElseThrow(() -> new NotFoundException("wallet not found"));

        List<CoinProvider.IncomingTransfer> transfers;
        try {
            transfers = provider.getIncomingTransfers(wallet.getAddress(), TX_FETCH_LIMIT);
        }
        catch (CryptoException e) {
            throw new BadGatewayException(e.getMessage());
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

    @Transactional
    public void applyDeposits(User user, List<Deposit> deposits) {
        depositRepository.saveAll(deposits);

        walletService.lock(user.getId());
        for (Deposit deposit : deposits) {
            walletService.addChange(user, deposit.getAmount(), BalanceChangeType.DEPOSIT, deposit.getCoin());
        }
    }
}
