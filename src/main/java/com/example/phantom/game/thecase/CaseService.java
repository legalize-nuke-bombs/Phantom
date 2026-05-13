package com.example.phantom.game.thecase;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.game.*;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

@Service
public class CaseService extends GameService<CaseInitRequest> {

    private final CaseSettings settings;

    public CaseService(UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRoundRepository gameRoundRepository, CaseSettings settings) {
        super(userRepository, walletService, provablyFairProvider, usageLimiter, gameRoundRepository);
        this.settings = settings;
    }

    public CaseSettings get() {
        return settings;
    }

    @Override
    protected GameType gameType() { return GameType.CASE; }

    @Override
    protected GameRound createRound(User user, CaseInitRequest request) {
        Case thecase = findCase(request.getCaseName());

        if (walletService.getBalance(user.getId()).compareTo(thecase.getCost()) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        GameRound round = new GameRound();
        round.setUser(user);
        round.setGameType(GameType.CASE);
        round.setBet(thecase.getCost());
        round.setServerSeed(provablyFairProvider.generateSeed());
        round.setData(Map.of("caseName", request.getCaseName()));
        return round;
    }

    @Override
    protected BigDecimal play(GameRound round, Random random) {
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
