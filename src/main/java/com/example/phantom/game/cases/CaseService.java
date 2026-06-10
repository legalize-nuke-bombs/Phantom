package com.example.phantom.game.cases;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.game.*;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Objects;
import java.util.Random;

@Service
public class CaseService extends GameService {

    private final CaseSettings settings;

    protected CaseService(CaseSettings settings, GameDependencies deps) {
        super(deps);
        this.settings = settings;
    }

    @Override
    public GameSettings get() {
        return settings;
    }

    @Override
    protected GameType gameType() { return GameType.CASES; }

    @Override
    protected Game initGame(Map<String, String> data) {
        String caseName = data.get("caseName");
        if (caseName == null) {
            throw new ApiException(ErrorCode.INVALID_CASE);
        }

        Case thecase = findCase(caseName);

        Game round = new Game();
        round.setBet(thecase.getCost());
        round.setData(Map.of("caseName", caseName));
        return round;
    }

    @Override
    protected Game runGame(Game game, Random random) {
        Case thecase = findCase(game.getData().get("caseName").toString());
        game.setResult(thecase.get(random.nextInt(thecase.getSize())));
        return game;
    }

    private Case findCase(String caseName) {
        for (Case thecase : settings.getCases()) {
            if (Objects.equals(thecase.getName(), caseName)) return thecase;
        }
        throw new ApiException(ErrorCode.INVALID_CASE);
    }
}
