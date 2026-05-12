package com.example.phantom.wallet;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
public class WalletRepresentation {
    private final Long id;
    private final BigDecimal balance;
    private final BigDecimal depositsSum;

    public WalletRepresentation(Wallet wallet) {
        this.id = wallet.getId();
        this.balance = wallet.getBalance();
        this.depositsSum = wallet.getDepositsSum();
    }
}
