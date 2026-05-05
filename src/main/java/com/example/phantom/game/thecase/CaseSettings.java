package com.example.phantom.game.thecase;

import com.example.phantom.game.util.FinanceColors;
import lombok.Getter;
import org.springframework.stereotype.Component;

import java.util.List;

@Getter
@Component
public class CaseSettings {
    private final List<Case> cases;

    public CaseSettings(FinanceColors financeColors) {
        this.cases = List.of(
                new Case(
                        "Nebula",
                        80, 0, 4, 2, 1,
                        financeColors
                ),
                new Case(
                        "Umbra",
                        0, 80, 4, 2, 1,
                        financeColors
                ),
                new Case(
                        "Spectrum",
                        0, 72, 10, 4, 1,
                        financeColors
                ),
                new Case(
                        "Phantom",
                        0, 67, 12, 6, 2,
                        financeColors
                )
        );
    }
}
