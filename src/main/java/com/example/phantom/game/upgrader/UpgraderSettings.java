package com.example.phantom.game.upgrader;

import lombok.Getter;

import java.math.BigDecimal;
import java.util.Map;

@Getter
public class UpgraderSettings {
    private final Map<Integer, BigDecimal> percents = Map.ofEntries(
            Map.entry(75, new BigDecimal("1.2")),
            Map.entry(50, new BigDecimal("1.8")),
            Map.entry(25, new BigDecimal("3.6")),
            Map.entry(10, new BigDecimal("9")),
            Map.entry(5, new BigDecimal("18")),
            Map.entry(1, new BigDecimal("90"))
    );
    private final BigDecimal minimalBet = new BigDecimal(1);
}
