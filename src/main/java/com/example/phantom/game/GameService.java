package com.example.phantom.game;

import org.springframework.stereotype.Service;

@Service
public class GameService {

    private final GameSettings settings;

    public GameService() {
        this.settings = new GameSettings();
    }

    public GameSettings get() {
        return settings;
    }
}
