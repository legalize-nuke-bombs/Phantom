package com.example.phantom.lottery;

import com.example.phantom.profile.ProfileCardRepresentation;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class FinishedLotteryRepresentation {
    private final Long id;
    private final Long timestamp;
    private final String seed1;
    private final String seed2;
    private final ProfileCardRepresentation profileCard;
    private final Long happyTicket;
    private final BigDecimal prize;
    private final Long ticketsSold;
}
