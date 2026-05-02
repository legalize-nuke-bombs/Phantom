package com.example.phantom.wallet;

import com.example.phantom.exception.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class WalletWithdrawalService {

    private final WalletRepository walletRepository;
    private final WithdrawalRepository withdrawalRepository;
    private final TransactionRepository transactionRepository;

    public WalletWithdrawalService(WalletRepository walletRepository, WithdrawalRepository withdrawalRepository, TransactionRepository transactionRepository) {
        this.walletRepository = walletRepository;
        this.withdrawalRepository = withdrawalRepository;
        this.transactionRepository = transactionRepository;
    }

    @Transactional
    public Wallet reserveMoney(Long userId, BigDecimal value) {
        Wallet wallet = walletRepository.findByUserIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
        wallet.setBalance(wallet.getBalance().subtract(value));
        if (wallet.getBalance().compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("insufficient balance");
        }
        return walletRepository.save(wallet);
    }

    @Transactional
    public Wallet refundMoney(Long userId, BigDecimal value) {
        Wallet wallet = walletRepository.findByUserIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
        wallet.setBalance(wallet.getBalance().add(value));
        return walletRepository.save(wallet);
    }

    @Transactional
    public Wallet withdrawalCheck(Long walletId, List<Withdrawal> withdrawals) {
        Wallet wallet = walletRepository.findByIdForPessimisticWrite(walletId).orElseThrow(() -> new NotFoundException("wallet not found"));

        for (Withdrawal w : withdrawals) {
            if (w.getStatus() == TxDetails.TxStatus.SUCCESS) {
                transactionRepository.insertIfNotExists(w.getId(), w.getValue());
                withdrawalRepository.delete(w);
            }
            else if (w.getStatus() == TxDetails.TxStatus.FAILED) {
                if (transactionRepository.insertIfNotExists(w.getId(), w.getValue()) == 1) {
                    wallet.setBalance(wallet.getBalance().add(w.getValue()));
                    withdrawalRepository.delete(w);
                }
            }
        }

        return walletRepository.save(wallet);
    }
}
