package com.example.phantom.game.thecase;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.game.*;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

@Service
public class CaseService extends AbstractGameService {

    private final CaseSettings settings;

    public CaseService(UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRoundRepository gameRoundRepository, CaseSettings settings) {
        super(userRepository, walletService, provablyFairProvider, usageLimiter, gameRoundRepository);
        this.settings = settings;
    }

    @Override
    protected GameType gameType() { return GameType.CASE; }

    @Override
    protected BigDecimal play(GameRound round, Random random) {
        Case thecase = findCase(round.getData().get("caseName"));
        return thecase.get(random.nextInt(thecase.getSize()));
    }

    public CaseSettings get() {
        return settings;
    }

    @Transactional
    public GameInitRepresentation init(Long userId, CaseInitRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        Case thecase = findCase(request.getCaseName());

        if (walletService.getBalance(userId).compareTo(thecase.getCost()) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        deleteActiveIfExists(userId);

        GameRound round = new GameRound();
        round.setUser(user);
        round.setGameType(GameType.CASE);
        round.setBet(thecase.getCost());
        round.setServerSeed(provablyFairProvider.generateSeed());
        round.setData(Map.of("caseName", request.getCaseName()));
        gameRoundRepository.save(round);

        GameInitRepresentation representation = new GameInitRepresentation();
        representation.setServerHash(provablyFairProvider.generateHash(round.getServerSeed()));
        return representation;
    }

    private Case findCase(String caseName) {
        for (Case thecase : settings.getCases()) {
            if (Objects.equals(thecase.getName(), caseName)) return thecase;
        }
        throw new BadRequestException("invalid caseName");
    }
}
