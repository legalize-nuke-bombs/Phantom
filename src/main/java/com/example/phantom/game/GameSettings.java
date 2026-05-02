package com.example.phantom.game;

import lombok.Getter;

import java.util.List;

@Getter
public class GameSettings {
    private final List<String> games = List.of(
            "upgrader",
            "cases"
    );
}
