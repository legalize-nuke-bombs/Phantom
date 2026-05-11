package com.example.phantom.ton.withdrawal;

import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoExchangeRateService;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.ServiceUnavailable;
import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.ton.TonApiException;
import com.example.phantom.ton.TonApiService;
import com.example.phantom.ton.TonConstants;
import com.example.phantom.ton.TonTransferStatus;
import com.example.phantom.user.User;
import com.example.phantom.variable.Variable;
import com.example.phantom.variable.VariableRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

@Service
@Slf4j
public class TonWithdrawalService {

    private final WalletRepository walletRepository;
    private final TonWithdrawalRepository tonWithdrawalRepository;
    private final TonRefundRepository tonRefundRepository;
    private final VariableRepository variableRepository;
    private final CryptoExchangeRateService cryptoExchangeRateService;
    private final TonApiService tonApiService;

    public TonWithdrawalService(
            WalletRepository walletRepository,
            TonWithdrawalRepository tonWithdrawalRepository,
            TonRefundRepository tonRefundRepository,
            VariableRepository variableRepository,
            CryptoExchangeRateService cryptoExchangeRateService,
            TonApiService tonApiService
    ) {
        this.walletRepository = walletRepository;
        this.tonWithdrawalRepository = tonWithdrawalRepository;
        this.tonRefundRepository = tonRefundRepository;
        this.variableRepository = variableRepository;
        this.cryptoExchangeRateService = cryptoExchangeRateService;
        this.tonApiService = tonApiService;
    }

    @Transactional
    public TonWithdrawal reserveFinances(User user, String receiver, BigDecimal amount) {
        Wallet wallet = walletRepository.findByIdForPessimisticWrite(user.getId()).orElseThrow(() -> new NotFoundException("wallet not found"));

        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        wallet.setBalance(wallet.getBalance().subtract(amount));
        walletRepository.save(wallet);

        TonWithdrawal withdrawal = new TonWithdrawal();
        withdrawal.setUser(user);
        withdrawal.setTimestamp(Instant.now().getEpochSecond());
        withdrawal.setReceiver(receiver);
        withdrawal.setAmount(amount);
        withdrawal.setStatus(TonTransferStatus.PENDING);
        return tonWithdrawalRepository.save(withdrawal);
    }

    public TonWithdrawal send(TonWithdrawal withdrawal) {
        Variable masterAddress = variableRepository.findById("TON_MASTER_WALLET_ADDRESS").orElseThrow(() -> new ServiceUnavailable("withdrawal failed, try again later"));
        Variable masterPrivateKey = variableRepository.findById("TON_MASTER_WALLET_PRIVATE_KEY").orElseThrow(() -> new ServiceUnavailable("withdrawal failed, try again later"));

        BigDecimal exchangeRate;
        try {
            exchangeRate = cryptoExchangeRateService.getTonUsdt();
        }
        catch (CryptoException e) {
            throw new ServiceUnavailable(e.getMessage());
        }

        BigDecimal toSend = withdrawal.getAmount().subtract(TonWithdrawalConstants.COMMISSION);
        BigDecimal toSendTon = toSend.divide(exchangeRate, FinanceConstants.SCALE, RoundingMode.DOWN);
        BigDecimal toSendNanoton = toSendTon.multiply(TonConstants.NANOTON);

        try {
            String hash = tonApiService.send(masterPrivateKey.getValue(),
                    masterAddress.getValue(),
                    withdrawal.getReceiver(),
                    toSendNanoton);
            withdrawal.setHash(hash);
        }
        catch (TonApiException e) {
            throw new ServiceUnavailable(e.getMessage());
        }

        return tonWithdrawalRepository.save(withdrawal);
    }

    public List<TonWithdrawal> checkPendingStatuses(Long userId) {
        List<TonWithdrawal> pending = tonWithdrawalRepository.findByUserIdAndStatus(userId, TonTransferStatus.PENDING);

        for (TonWithdrawal withdrawal : pending) {
            if (withdrawal.getHash() == null) {
                withdrawal.setStatus(TonTransferStatus.REJECTED);
                continue;
            }

            try {
                TonTransferStatus status = tonApiService.checkTransferStatus(
                        withdrawal.getHash(),
                        withdrawal.getTimestamp(),
                        TonWithdrawalConstants.VALIDATION_DURATION
                );
                withdrawal.setStatus(status);
            }
            catch (TonApiException e) {
                log.warn("failed to check status for withdrawal {}, leaving as PENDING", withdrawal.getId());
            }
        }

        return pending;
    }

    @Transactional
    public void applyCheckedStatuses(Long userId, List<TonWithdrawal> checked) {
        Wallet wallet = walletRepository.findByIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));

        for (TonWithdrawal w : checked) {
            log.info("applying withdrawal {} status={}", w.getId(), w.getStatus());
            if (w.getStatus() == TonTransferStatus.REJECTED) {
                if (tonRefundRepository.insertIfNotExists(w.getId()) > 0) {
                    wallet.setBalance(wallet.getBalance().add(w.getAmount()));
                    log.info("withdrawal {} refund {}", w.getId(), w.getAmount());
                }
                else {
                    log.info("withdrawal {} no refund", w.getId());
                }
            }
        }

        tonWithdrawalRepository.saveAll(checked);

        walletRepository.save(wallet);
    }
}
