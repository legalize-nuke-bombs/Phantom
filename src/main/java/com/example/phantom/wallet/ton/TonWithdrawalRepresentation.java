package com.example.phantom.wallet.ton;

import com.example.phantom.crypto.ton.TonTransferStatus;
import lombok.Getter;
import java.math.BigDecimal;

@Getter
public class TonWithdrawalRepresentation {
    private final Long timestamp;
    private final String receiver;
    private final BigDecimal amount;
    private final TonTransferStatus status;
    private final String hash;

    public TonWithdrawalRepresentation(TonWithdrawal tonWithdrawal) {
        this.timestamp = tonWithdrawal.getTimestamp();
        this.receiver = tonWithdrawal.getReceiver();
        this.amount = tonWithdrawal.getAmount();
        this.status = tonWithdrawal.getStatus();
        this.hash = tonWithdrawal.getHash();
    }
}
