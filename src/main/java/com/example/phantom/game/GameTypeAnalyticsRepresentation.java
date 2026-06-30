package com.example.phantom.game;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class GameTypeAnalyticsRepresentation {
    private final Long count;
    private final BigDecimal bets;
    private final BigDecimal results;
}
