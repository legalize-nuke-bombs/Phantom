package com.example.phantom.ton.withdrawal;

import com.example.phantom.ton.TonTransferStatus;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class TonWithdrawalRepresentation {
    private final Long timestamp;
    private final String receiver;
    private final BigDecimal amount;
    private final TonTransferStatus status;
    private final String hash;

    public TonWithdrawalRepresentation(TonWithdrawal withdrawal) {
        this.timestamp = withdrawal.getTimestamp();
        this.receiver = withdrawal.getReceiver();
        this.amount = withdrawal.getAmount();
        this.status = withdrawal.getStatus();
        this.hash = withdrawal.getHash();
    }
}
