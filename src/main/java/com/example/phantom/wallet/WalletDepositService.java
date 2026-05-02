package com.example.phantom.wallet;

import com.example.phantom.exception.*;
import com.example.phantom.money.MoneyConstants;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class WalletDepositService {
    private final WalletRepository walletRepository;
    private final TransactionRepository depositRepository;

    WalletDepositService(WalletRepository walletRepository, TransactionRepository depositRepository) {
        this.walletRepository = walletRepository;
        this.depositRepository = depositRepository;
    }

    @Transactional
    public Wallet applyDeposit(Long walletId, TxDetails txDetails) {
        Wallet wallet = walletRepository.findByIdForPessimisticWrite(walletId).orElseThrow(() -> new NotFoundException("wallet not found"));

        BigDecimal value = new BigDecimal(txDetails.rawAmount()).divide(new BigDecimal(1000000), MoneyConstants.SCALE, RoundingMode.DOWN);

        if (depositRepository.insertIfNotExists(txDetails.txId(), value) == 1) {
            wallet.setBalance(wallet.getBalance().add(value));
            wallet.setDepositsSum(wallet.getDepositsSum().add(value));
        }

        return walletRepository.save(wallet);
    }
}
