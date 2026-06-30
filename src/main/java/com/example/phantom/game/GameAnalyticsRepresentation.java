package com.example.phantom.game;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Map;

@Getter
@AllArgsConstructor
public class GameAnalyticsRepresentation {
    private final Map<GameType, GameTypeAnalyticsRepresentation> data;
}
