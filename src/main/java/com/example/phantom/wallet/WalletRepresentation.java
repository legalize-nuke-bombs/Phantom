package com.example.phantom.wallet;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class WalletRepresentation {
    private final Long id;
    private final BigDecimal balance;
    private final BigDecimal depositsSum;

    public WalletRepresentation(Long id, BigDecimal balance, BigDecimal depositsSum) {
        this.id = id;
        this.balance = balance;
        this.depositsSum = depositsSum;
    }
}
