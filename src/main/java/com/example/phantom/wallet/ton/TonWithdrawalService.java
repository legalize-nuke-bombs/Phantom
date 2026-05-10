package com.example.phantom.wallet.ton;

import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoExchangeRateService;
import com.example.phantom.crypto.ton.TonApiException;
import com.example.phantom.crypto.ton.TonReadService;
import com.example.phantom.crypto.ton.TonTransferService;
import com.example.phantom.crypto.ton.TonTransferStatus;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.ServiceUnavailable;
import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.user.User;
import com.example.phantom.variable.Variable;
import com.example.phantom.variable.VariableRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

@Service
public class TonWithdrawalService {

    private final WalletRepository walletRepository;
    private final TonWithdrawalRepository tonWithdrawalRepository;
    private final VariableRepository variableRepository;

    private final CryptoExchangeRateService cryptoExchangeRateService;
    private final TonTransferService tonTransferService;
    private final TonReadService tonReadService;

    public TonWithdrawalService(WalletRepository walletRepository, TonWithdrawalRepository tonWithdrawalRepository, VariableRepository variableRepository, CryptoExchangeRateService cryptoExchangeRateService, TonTransferService tonTransferService, TonReadService tonReadService) {
        this.walletRepository = walletRepository;
        this.tonWithdrawalRepository = tonWithdrawalRepository;
        this.variableRepository = variableRepository;

        this.cryptoExchangeRateService = cryptoExchangeRateService;
        this.tonTransferService = tonTransferService;
        this.tonReadService = tonReadService;
    }

    @Transactional
    public TonWithdrawal reserveFinances(User user, String receiver, BigDecimal amount) {
        Wallet wallet = walletRepository.findByIdForPessimisticWrite(user.getId()).orElseThrow(() -> new NotFoundException("wallet not found"));
        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        wallet.setBalance(wallet.getBalance().subtract(amount));
        walletRepository.save(wallet);

        TonWithdrawal tonWithdrawal = new TonWithdrawal();
        tonWithdrawal.setUser(user);
        tonWithdrawal.setTimestamp(Instant.now().getEpochSecond());
        tonWithdrawal.setReceiver(receiver);
        tonWithdrawal.setAmount(amount);
        tonWithdrawal.setStatus(TonTransferStatus.PENDING);
        return tonWithdrawalRepository.save(tonWithdrawal);
    }

    public TonWithdrawal send(TonWithdrawal tonWithdrawal) {
        Variable masterPrivateKey = variableRepository.findById("TON_MASTER_WALLET_PRIVATE_KEY").orElseThrow(() -> new ServiceUnavailable("withdrawal failed, try again later"));
        String masterPrivateKeyValue = masterPrivateKey.getValue();

        BigDecimal exchangeRate;
        try { exchangeRate = cryptoExchangeRateService.getTonUsdt(); }
        catch ( CryptoException e ) { throw new ServiceUnavailable(e.getMessage()); }

        BigDecimal toSend = tonWithdrawal.getAmount().subtract(TonConstants.WITHDRAWAL_COMMISSION);
        BigDecimal toSendTon = toSend.divide(exchangeRate, FinanceConstants.SCALE, RoundingMode.DOWN);

        String hash;
        try { hash = tonTransferService.send(masterPrivateKeyValue, tonWithdrawal.getReceiver(), toSendTon); }
        catch ( TonApiException e) { throw new ServiceUnavailable(e.getMessage()); }

        tonWithdrawal.setHash(hash);
        return tonWithdrawalRepository.save(tonWithdrawal);
    }

    public List<TonWithdrawal> fetchPendingWithdrawals(Long userId) {
        List<TonWithdrawal> pendingWithdrawals = tonWithdrawalRepository.findByUserIdAndStatus(userId, TonTransferStatus.PENDING);

        for (TonWithdrawal tonWithdrawal : pendingWithdrawals) {
            String hash = tonWithdrawal.getHash();
            Long timestamp = tonWithdrawal.getTimestamp();

            TonTransferStatus status;
            if (hash == null) {
                status = TonTransferStatus.REJECTED;
            }
            else {
                try { status = tonReadService.checkStatus(hash, timestamp, TonConstants.WITHDRAWAL_VALIDATION_DURATION); }
                catch (TonApiException e) { status = TonTransferStatus.PENDING; }
            }

            tonWithdrawal.setStatus(status);
        }

        return pendingWithdrawals;
    }

    // TODO fix possible thread race condition
    @Transactional
    public List<TonWithdrawal> handlePendingWithdrawals(Long userId, List<TonWithdrawal> tonWithdrawals) {
        Wallet wallet = walletRepository.findByIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));

        for (TonWithdrawal tonWithdrawal : tonWithdrawals) {
            if (tonWithdrawal.getStatus() == TonTransferStatus.REJECTED) {
                wallet.setBalance(wallet.getBalance().add(tonWithdrawal.getAmount()));
            }
        }

        walletRepository.save(wallet);

        return tonWithdrawalRepository.saveAll(tonWithdrawals);
    }
}
