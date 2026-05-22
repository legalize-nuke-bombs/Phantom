package com.example.phantom.lottery;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class CurrentLotteryRepresentation {
    private final Long id;

    private final Long timestampStart;
    private final Long timestampBlock;
    private final Long timestampEnd;

    private final String seed1Hash;
    private final String seed2Hash;

    private final BigDecimal ticketCost;

    private final Long ticketsAmountPersonal;
    private final Long ticketsAmountTotal;

    private final BigDecimal costPersonal;
    private final BigDecimal costTotal;
}
