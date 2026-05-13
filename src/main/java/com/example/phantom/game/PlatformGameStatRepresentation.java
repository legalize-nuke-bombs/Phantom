package com.example.phantom.game;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class PlatformGameStatRepresentation {
    private final Long totalGames;
    private final Long totalGames24h;
    private final BigDecimal maxWin;
    private final BigDecimal maxWin24h;
}
