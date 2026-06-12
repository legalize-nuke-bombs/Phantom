package com.example.phantom.crypto.withdrawal;

import com.example.phantom.crypto.CoinType;
import com.example.phantom.crypto.TransferStatus;
import com.example.phantom.profile.ProfileCardRepresentation;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class WithdrawalRepresentation {
    private final Long id;
    private final ProfileCardRepresentation profileCard;
    private final CoinType coin;
    private final Long timestamp;
    private final String receiver;
    private final BigDecimal amount;
    private final TransferStatus status;
    private final String hash;

    public WithdrawalRepresentation(Withdrawal withdrawal, ProfileCardRepresentation profileCard) {
        this.id = withdrawal.getId();
        this.profileCard = profileCard;
        this.coin = withdrawal.getCoin();
        this.timestamp = withdrawal.getTimestamp();
        this.receiver = withdrawal.getReceiver();
        this.amount = withdrawal.getAmount();
        this.status = withdrawal.getStatus();
        this.hash = withdrawal.getHash();
    }
}
