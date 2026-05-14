package com.example.phantom.game.coinflip;

import lombok.Getter;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Getter
@Component
public class CoinFlipSettings implements com.example.phantom.game.GameSettings {
    private final BigDecimal minimalBet = new BigDecimal(5);
    private final BigDecimal multiplier = new BigDecimal("1.8");
}
