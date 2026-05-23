package com.example.phantom.lottery;

import com.example.phantom.profile.ProfileCardRepresentation;
import lombok.Getter;

@Getter
public class LotteryBetRepresentation {
    private final Long id;
    private final ProfileCardRepresentation profileCard;
    private final Long tickets;

    public LotteryBetRepresentation(LotteryBet lotteryBet, ProfileCardRepresentation profileCard) {
        this.id = lotteryBet.getId();
        this.profileCard = profileCard;
        this.tickets = lotteryBet.getTickets();
    }
}
