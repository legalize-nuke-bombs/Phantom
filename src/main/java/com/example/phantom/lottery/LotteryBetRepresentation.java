package com.example.phantom.lottery;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

@Getter
public class LotteryBetRepresentation {
    private final Long id;
    private final UserShortRepresentation user;
    private final Long tickets;

    public LotteryBetRepresentation(LotteryBet lotteryBet, UserShortRepresentation user) {
        this.id = lotteryBet.getId();
        this.user = user;
        this.tickets = lotteryBet.getTickets();
    }
}
