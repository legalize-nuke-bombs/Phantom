package com.example.phantom.game.thecase;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.game.*;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

@Service
public class CaseService extends GameService {

    private final CaseSettings settings;

    public CaseService(UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRepository gameRepository, CaseSettings settings) {
        super(userRepository, walletService, provablyFairProvider, usageLimiter, gameRepository);
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
            throw new BadRequestException("caseName is required");
        }

        Case thecase = findCase(caseName);

        Game round = new Game();
        round.setGameType(GameType.CASES);
        round.setBet(thecase.getCost());
        round.setData(Map.of("caseName", caseName));
        return round;
    }

    @Override
    protected BigDecimal runGame(Game round, Random random) {
        Case thecase = findCase(round.getData().get("caseName"));
        return thecase.get(random.nextInt(thecase.getSize()));
    }

    private Case findCase(String caseName) {
        for (Case thecase : settings.getCases()) {
            if (Objects.equals(thecase.getName(), caseName)) return thecase;
        }
        throw new BadRequestException("invalid caseName");
    }
}
