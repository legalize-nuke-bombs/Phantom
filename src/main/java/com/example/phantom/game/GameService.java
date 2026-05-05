package com.example.phantom.game;

import com.example.phantom.game.util.FinanceColors;
import org.springframework.stereotype.Service;

@Service
public class GameService {

    private final GameSettings settings;
    private final FinanceColors financeColors;

    public GameService(GameSettings settings, FinanceColors financeColors) {
        this.settings = settings;
        this.financeColors = financeColors;
    }

    public GameSettings get() {
        return settings;
    }
    public FinanceColors getFinanceColors() { return financeColors; }
}
