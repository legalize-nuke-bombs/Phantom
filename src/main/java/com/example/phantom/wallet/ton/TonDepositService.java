package com.example.phantom.wallet.ton;

import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoExchangeService;
import com.example.phantom.crypto.ton.TonApiException;
import com.example.phantom.crypto.ton.TonApiService;
import com.example.phantom.exception.BadGatewayException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.finance.FinanceConstants;
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

    private final WalletRepository walletRepository;
    private final TonWalletRepository tonWalletRepository;
    private final TonDepositRepository tonDepositRepository;

    private final TonApiService tonApiService;
    private final CryptoExchangeService cryptoExchangeService;

    private static final int TX_FETCH_LIMIT = 20;

    public TonDepositService(WalletRepository walletRepository, TonWalletRepository tonWalletRepository, TonDepositRepository tonDepositRepository, TonApiService tonApiService, CryptoExchangeService cryptoExchangeService) {
        this.walletRepository = walletRepository;
        this.tonWalletRepository = tonWalletRepository;
        this.tonDepositRepository = tonDepositRepository;

        this.tonApiService = tonApiService;
        this.cryptoExchangeService = cryptoExchangeService;
    }

    public List<TonDeposit> fetchDeposits(User user) {
        TonWallet tonWallet = tonWalletRepository.findByUserId(user.getId()).orElseThrow(() -> new NotFoundException("ton wallet not found"));

        List<TonApiService.TonTransaction> transactions;
        try { transactions = tonApiService.getTransactions(tonWallet.getAddress(), TX_FETCH_LIMIT); }
        catch (TonApiException e) { throw new BadGatewayException("failed to fetch transactions"); }

        List<String> txHashes = transactions.stream()
                .map(TonApiService.TonTransaction::hash)
                .toList();

        Set<String> existingHashes = new HashSet<>(tonDepositRepository.findExistingHashes(txHashes));
        List<TonApiService.TonTransaction> newTransactions = transactions.stream()
                .filter(tx -> !existingHashes.contains(tx.hash()))
                .toList();

        BigDecimal tonUsdtRate;
        try { tonUsdtRate = cryptoExchangeService.getTonUsdt(); }
        catch (CryptoException e) { throw new BadGatewayException("failed to get exchange rate"); }

        Long now = Instant.now().getEpochSecond();
        List<TonDeposit> deposits = new ArrayList<>();

        for (TonApiService.TonTransaction tx : newTransactions) {
            BigDecimal usdAmount = tx.value()
                    .multiply(tonUsdtRate)
                    .setScale(FinanceConstants.SCALE, RoundingMode.DOWN);

            TonDeposit deposit = new TonDeposit();
            deposit.setUser(user);
            deposit.setTxHash(tx.hash());
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
