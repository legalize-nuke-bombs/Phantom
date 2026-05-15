package com.example.phantom.game.thecase;

import com.example.phantom.finance.FinanceColors;
import com.example.phantom.game.GameSettings;
import lombok.Getter;
import org.springframework.stereotype.Component;

import java.util.List;

@Getter
@Component
public class CaseSettings implements GameSettings {
    private final List<Case> cases;

    public CaseSettings(FinanceColors financeColors) {
        this.cases = List.of(
                new Case(
                        "Nox",
                        90, 0, 9, 1, 0,
                        financeColors
                ),
                new Case(
                        "Selene",
                        0, 45, 4, 1, 0,
                        financeColors
                ),
                new Case(
                        "Caligo",
                        180, 0, 19, 0, 1,
                        financeColors
                ),
                new Case(
                        "Phantom",
                        0, 90, 9, 0, 1,
                        financeColors
                )
        );
    }
}
