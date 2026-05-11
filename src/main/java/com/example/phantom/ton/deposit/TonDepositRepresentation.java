package com.example.phantom.ton.deposit;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class TonDepositRepresentation {
    private final Long timestamp;
    private final String txHash;
    private final BigDecimal amount;

    public TonDepositRepresentation(TonDeposit deposit) {
        this.timestamp = deposit.getTimestamp();
        this.txHash = deposit.getTxHash();
        this.amount = deposit.getAmount();
    }
}
