package com.example.phantom.game;

import org.springframework.stereotype.Service;

@Service
public class GameService {

    private final GameSettings settings;

    public GameService(GameSettings settings) {
        this.settings = settings;
    }

    public GameSettings get() {
        return settings;
    }
}
