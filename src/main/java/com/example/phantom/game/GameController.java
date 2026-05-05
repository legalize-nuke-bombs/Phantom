package com.example.phantom.game;

import com.example.phantom.game.util.FinanceColors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games")
public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    @GetMapping
    public GameSettings get() {
        return gameService.get();
    }

    @GetMapping("/finance-colors")
    public FinanceColors getFinanceColors() { return gameService.getFinanceColors(); }
}
