package com.example.phantom.crypto.withdrawal;

import com.example.phantom.crypto.TransferStatus;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class WithdrawalRepresentation {
    private final Long id;
    private final String coin;
    private final Long timestamp;
    private final String receiver;
    private final BigDecimal amount;
    private final TransferStatus status;
    private final String hash;

    public WithdrawalRepresentation(Withdrawal withdrawal) {
        this.id = withdrawal.getId();
        this.coin = withdrawal.getCoin();
        this.timestamp = withdrawal.getTimestamp();
        this.receiver = withdrawal.getReceiver();
        this.amount = withdrawal.getAmount();
        this.status = withdrawal.getStatus();
        this.hash = withdrawal.getHash();
    }
}
