package com.example.phantom.wallet;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class WalletRepresentation {
    private final Long id;
    private final BigDecimal balance;

    public WalletRepresentation(Long id, BigDecimal balance) {
        this.id = id;
        this.balance = balance;
    }
}
