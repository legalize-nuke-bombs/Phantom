package com.example.phantom.game;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class PersonalGameStatRepresentation {
    private final Long totalGames;
    private final BigDecimal maxWin;
}
