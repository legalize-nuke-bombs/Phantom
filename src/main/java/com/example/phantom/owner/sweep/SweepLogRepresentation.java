package com.example.phantom.owner.sweep;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class SweepLogRepresentation {
    private final Long id;
    private final Long timestamp;
    private final String sender;
    private final String receiver;
    private final BigDecimal amount;
    private final String status;

    public SweepLogRepresentation(SweepLog sweepLog) {
        this.id = sweepLog.getId();
        this.timestamp = sweepLog.getTimestamp();
        this.sender = sweepLog.getSender();
        this.receiver = sweepLog.getReceiver();
        this.amount = sweepLog.getAmount();
        this.status = sweepLog.getStatus();
    }
}
