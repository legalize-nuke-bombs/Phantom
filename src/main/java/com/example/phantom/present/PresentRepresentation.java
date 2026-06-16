package com.example.phantom.present;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class PresentRepresentation {
    private final Long id;
    private final Boolean claimed;
    private final Long timestamp;
    private final BigDecimal amount;
    private final String description;
    private final UserShortRepresentation sender;

    public PresentRepresentation(Present present) {
        this.id = present.getId();
        this.claimed = present.getClaimed();
        this.timestamp = present.getTimestamp();
        this.amount = present.getAmount();
        this.description = present.getDescription();
        this.sender = present.getSender() != null ? new UserShortRepresentation(present.getSender()) : null;
    }
}
