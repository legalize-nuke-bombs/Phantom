package com.example.phantom.wallet;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class WalletRepresentation {
    private final Long id;
    private final BigDecimal balance;

    public WalletRepresentation(Wallet wallet) {
        this.id = wallet.getId();
        this.balance = wallet.getBalanceCached();
    }
}
