package com.example.phantom.game.upgrader;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.game.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Random;

@Service
public class UpgraderService extends GameService {

    private final UpgraderSettings settings;

    protected UpgraderService(UpgraderSettings settings, GameDependencies deps) {
        super(deps);
        this.settings = settings;
    }

    @Override
    public GameSettings get() {
        return settings;
    }

    @Override
    protected GameType gameType() { return GameType.UPGRADER; }

    @Override
    protected Game initGame(Map<String, String> data) {
        String betStr = data.get("bet");
        String percentStr = data.get("percent");
        if (betStr == null || percentStr == null) {
            throw new ApiException(ErrorCode.INVALID_BET);
        }

        BigDecimal bet;
        int percent;
        try {
            bet = new BigDecimal(betStr);
            percent = Integer.parseInt(percentStr);
        }
        catch (NumberFormatException e) {
            throw new ApiException(ErrorCode.INVALID_BET);
        }

        if (bet.compareTo(settings.getMinimalBet()) < 0) {
            throw new ApiException(ErrorCode.INVALID_BET);
        }

        BigDecimal multiplier = settings.getPercents().get(percent);
        if (multiplier == null) {
            throw new ApiException(ErrorCode.GAME_OPTION_UNAVAILABLE);
        }

        Game round = new Game();
        round.setGameType(GameType.UPGRADER);
        round.setBet(bet);
        round.setData(Map.of("percent", String.valueOf(percent), "possibleResult", bet.multiply(multiplier).toPlainString()));
        return round;
    }

    @Override
    protected Game runGame(Game game, Random random) {
        int percent = Integer.parseInt(game.getData().get("percent").toString());
        int randomResult = random.nextInt(100) + 1;
        game.setResult(percent >= randomResult
                ? new BigDecimal(game.getData().get("possibleResult").toString())
                : BigDecimal.ZERO
        );
        return game;
    }
}
