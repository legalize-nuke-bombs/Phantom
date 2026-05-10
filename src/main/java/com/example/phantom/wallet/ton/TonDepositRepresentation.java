package com.example.phantom.wallet.ton;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class TonDepositRepresentation {
    private final Long timestamp;
    private final String txHash;
    private final BigDecimal amount;

    public TonDepositRepresentation(TonDeposit tonDeposit) {
        this.timestamp = tonDeposit.getTimestamp();
        this.txHash = tonDeposit.getTxHash();
        this.amount = tonDeposit.getAmount();
    }
}