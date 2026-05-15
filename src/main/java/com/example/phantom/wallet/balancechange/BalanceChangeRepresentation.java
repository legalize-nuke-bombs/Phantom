package com.example.phantom.wallet.balancechange;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class BalanceChangeRepresentation {
    private final Long id;
    private final BigDecimal amount;
    private final BalanceChangeType type;
    private final Long timestamp;
    private final String details;

    public BalanceChangeRepresentation(BalanceChange balanceChange) {
        this.id = balanceChange.getId();
        this.amount = balanceChange.getAmount();
        this.type = balanceChange.getType();
        this.timestamp = balanceChange.getTimestamp();
        this.details = balanceChange.getDetails();
    }
}
