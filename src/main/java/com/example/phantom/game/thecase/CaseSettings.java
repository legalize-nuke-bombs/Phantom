package com.example.phantom.game.thecase;

import lombok.Getter;

import java.util.List;

@Getter
public class CaseSettings {
    private final List<Case> cases = List.of(
            new Case(
                    "Nebula",
                    80, 0, 4, 2, 1
            ),
            new Case(
                    "Umbra",
                    0, 80, 4, 2, 1
            ),
            new Case(
                    "Spectrum",
                    0, 72, 10, 4, 1
            ),
            new Case(
                    "Phantom",
                    0, 67, 12, 6, 2
            )
    );
}
