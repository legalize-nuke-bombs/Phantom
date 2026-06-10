package com.example.phantom.game.fruits;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.game.*;
import com.example.phantom.game.util.slot.SpinRepresentation;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Random;

@Service
public class FruitService extends GameService {

    private final FruitSettings settings;

    protected FruitService(FruitSettings settings, GameDependencies deps) {
        super(deps);
        this.settings = settings;
    }

    @Override
    protected GameSettings get() {
        return settings;
    }

    @Override
    protected GameType gameType() {
        return GameType.FRUITS;
    }

    @Override
    protected Game initGame(Map<String, String> data) {
        String betStr = data.get("bet");
        if (betStr == null) {
            throw new ApiException(ErrorCode.INVALID_BET);
        }

        BigDecimal bet;
        try {
            bet = new BigDecimal(betStr);
        }
        catch (Exception e) {
            throw new ApiException(ErrorCode.INVALID_BET);
        }

        if (bet.compareTo(new BigDecimal(settings.getMinBet())) < 0) {
            throw new ApiException(ErrorCode.INVALID_BET);
        }

        Game game = new Game();
        game.setBet(bet);
        return game;
    }

    @Override
    protected Game runGame(Game game, Random random) {
        SpinRepresentation spin = settings.getSlots().getData().spin(random);

        game.setResult(game.getBet().multiply(spin.k()));
        game.getData().put("data", spin.data());
        game.getData().put("patternMatches", spin.patternMatches());

        return game;
    }
}
