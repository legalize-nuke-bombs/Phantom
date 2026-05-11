package com.example.phantom.ton.deposit;

import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoExchangeRateService;
import com.example.phantom.exception.BadGatewayException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.ton.TonApiException;
import com.example.phantom.ton.TonApiService;
import com.example.phantom.ton.TonWallet;
import com.example.phantom.ton.TonWalletRepository;
import com.example.phantom.user.User;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Service
public class TonDepositService {

    private static final int TX_FETCH_LIMIT = 20;

    private final WalletRepository walletRepository;
    private final TonWalletRepository tonWalletRepository;
    private final TonDepositRepository tonDepositRepository;
    private final TonApiService tonApiService;
    private final CryptoExchangeRateService cryptoExchangeRateService;

    public TonDepositService(
            WalletRepository walletRepository,
            TonWalletRepository tonWalletRepository,
            TonDepositRepository tonDepositRepository,
            TonApiService tonApiService,
            CryptoExchangeRateService cryptoExchangeRateService
    ) {
        this.walletRepository = walletRepository;
        this.tonWalletRepository = tonWalletRepository;
        this.tonDepositRepository = tonDepositRepository;
        this.tonApiService = tonApiService;
        this.cryptoExchangeRateService = cryptoExchangeRateService;
    }

    public List<TonDeposit> fetchDeposits(User user) {
        TonWallet tonWallet = tonWalletRepository.findByUserId(user.getId()).orElseThrow(() -> new NotFoundException("ton wallet not found"));

        List<TonApiService.IncomingTransfer> transfers;
        try {
            transfers = tonApiService.getIncomingTransfers(tonWallet.getAddress(), TX_FETCH_LIMIT);
        }
        catch (TonApiException e) {
            throw new BadGatewayException(e.getMessage());
        }

        if (transfers.isEmpty()) {
            return List.of();
        }

        List<String> txHashes = transfers.stream()
                .map(TonApiService.IncomingTransfer::txHash)
                .toList();

        Set<String> existingHashes = new HashSet<>(tonDepositRepository.findExistingHashes(txHashes));

        List<TonApiService.IncomingTransfer> newTransfers = transfers.stream()
                .filter(tx -> !existingHashes.contains(tx.txHash()))
                .toList();

        if (newTransfers.isEmpty()) {
            return List.of();
        }

        BigDecimal tonUsdtRate;
        try {
            tonUsdtRate = cryptoExchangeRateService.getTonUsdt();
        }
        catch (CryptoException e) {
            throw new BadGatewayException(e.getMessage());
        }

        long now = Instant.now().getEpochSecond();
        List<TonDeposit> deposits = new ArrayList<>();

        for (TonApiService.IncomingTransfer tx : newTransfers) {
            BigDecimal usdAmount = tx.amountTon()
                    .multiply(tonUsdtRate)
                    .setScale(FinanceConstants.SCALE, RoundingMode.DOWN);

            TonDeposit deposit = new TonDeposit();
            deposit.setUser(user);
            deposit.setTxHash(tx.txHash());
            deposit.setAmount(usdAmount);
            deposit.setTimestamp(now);
            deposits.add(deposit);
        }

        return deposits;
    }

    @Transactional
    public void applyDeposits(User user, List<TonDeposit> deposits) {
        tonDepositRepository.saveAll(deposits);

        BigDecimal totalAmount = BigDecimal.ZERO;
        for (TonDeposit deposit : deposits) {
            totalAmount = totalAmount.add(deposit.getAmount());
        }

        Wallet wallet = walletRepository.findByIdForPessimisticWrite(user.getId()).orElseThrow(() -> new NotFoundException("wallet not found"));

        wallet.setBalance(wallet.getBalance().add(totalAmount));
        wallet.setDepositsSum(wallet.getDepositsSum().add(totalAmount));
        walletRepository.save(wallet);
    }
}
