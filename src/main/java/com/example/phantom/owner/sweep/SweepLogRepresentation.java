package com.example.phantom.owner.sweep;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class SweepLogRepresentation {
    private final Long id;
    private final Long timestamp;
    private final String coin;
    private final String sender;
    private final BigDecimal amount;
    private final String receiver;
    private final String status;
    private final String hash;

    public SweepLogRepresentation(SweepLog sweepLog) {
        this.id = sweepLog.getId();
        this.timestamp = sweepLog.getTimestamp();
        this.coin = sweepLog.getCoin();
        this.sender = sweepLog.getSender();
        this.amount = sweepLog.getAmount();
        this.receiver = sweepLog.getReceiver();
        this.status = sweepLog.getStatus();
        this.hash = sweepLog.getHash();
    }
}
