package com.example.phantom.crypto.withdrawal;

import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CoinProviderRegistry;
import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.TransferStatus;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.ServiceUnavailable;
import com.example.phantom.user.User;
import com.example.phantom.variable.Variable;
import com.example.phantom.variable.VariableRepository;
import com.example.phantom.wallet.WalletService;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
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
    private final RefundRepository refundRepository;
    private final VariableRepository variableRepository;
    private final CoinProviderRegistry coinProviderRegistry;

    public WithdrawalService(
            WalletService walletService,
            WithdrawalRepository withdrawalRepository,
            RefundRepository refundRepository,
            VariableRepository variableRepository,
            CoinProviderRegistry coinProviderRegistry
    ) {
        this.walletService = walletService;
        this.withdrawalRepository = withdrawalRepository;
        this.refundRepository = refundRepository;
        this.variableRepository = variableRepository;
        this.coinProviderRegistry = coinProviderRegistry;
    }

    @Transactional
    public Withdrawal reserveFinances(User user, String coin, String receiver, BigDecimal amount) {
        CoinProvider provider = coinProviderRegistry.get(coin);
        provider.validateAddress(receiver);

        BigDecimal commission = provider.getWithdrawalCommission();
        if (amount.compareTo(commission) <= 0) {
            throw new BadRequestException("amount must be greater than commission");
        }

        walletService.lock(user.getId());

        if (walletService.getBalance(user.getId()).compareTo(amount) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        walletService.addChange(user, amount.negate(), BalanceChangeType.WITHDRAWAL, coin);

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
        Variable masterAddress = variableRepository.findById(withdrawal.getCoin() + "_MASTER_WALLET_ADDRESS")
                .orElseThrow(() -> new ServiceUnavailable("withdrawal failed, try again later"));
        Variable masterPrivateKey = variableRepository.findById(withdrawal.getCoin() + "_MASTER_WALLET_PRIVATE_KEY")
                .orElseThrow(() -> new ServiceUnavailable("withdrawal failed, try again later"));

        BigDecimal toSend = withdrawal.getAmount().subtract(provider.getWithdrawalCommission());

        try {
            String hash = provider.send(
                    masterPrivateKey.getValue(),
                    masterAddress.getValue(),
                    withdrawal.getReceiver(),
                    toSend);
            withdrawal.setHash(hash);
        }
        catch (CryptoException e) {
            throw new ServiceUnavailable(e.getMessage());
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
                        withdrawal.getTimestamp());
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
        walletService.lock(userId);

        for (Withdrawal w : checked) {
            log.info("applying withdrawal {} status={}", w.getId(), w.getStatus());

            if (w.getStatus() == TransferStatus.REJECTED && refundRepository.insertIfNotExists(w.getId()) == 1) {
                walletService.addChange(w.getUser(), w.getAmount(), BalanceChangeType.WITHDRAWAL_REFUND, w.getCoin());
                log.info("withdrawal {} refund {}", w.getId(), w.getAmount());
            }
        }

        withdrawalRepository.saveAll(checked);
    }
}
