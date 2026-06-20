package com.example.phantom.crypto.deposit;

import com.example.phantom.crypto.CoinType;
import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class DepositRepresentation {
    private final Long id;
    private final UserShortRepresentation user;
    private final CoinType coin;
    private final Long timestamp;
    private final String txHash;
    private final BigDecimal amount;

    public DepositRepresentation(Deposit deposit) {
        this.id = deposit.getId();
        this.user = new UserShortRepresentation(deposit.getUser());
        this.coin = deposit.getCoin();
        this.timestamp = deposit.getTimestamp();
        this.txHash = deposit.getTxHash();
        this.amount = deposit.getAmount();
    }
}
