package com.example.phantom.crypto.deposit;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class DepositRepresentation {
    private final Long id;
    private final String coin;
    private final Long timestamp;
    private final String txHash;
    private final BigDecimal amount;

    public DepositRepresentation(Deposit deposit) {
        this.id = deposit.getId();
        this.coin = deposit.getCoin();
        this.timestamp = deposit.getTimestamp();
        this.txHash = deposit.getTxHash();
        this.amount = deposit.getAmount();
    }
}
