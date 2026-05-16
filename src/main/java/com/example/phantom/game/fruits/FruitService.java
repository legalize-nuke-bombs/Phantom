package com.example.phantom.game.fruits;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.game.*;
import com.example.phantom.game.util.slot.PatternMatch;
import com.example.phantom.game.util.slot.Slot;
import com.example.phantom.game.util.slot.SpinRepresentation;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import com.google.gson.JsonArray;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Random;

@Service
public class FruitService extends GameService {

    private final FruitSettings settings;

    public FruitService(FruitSettings settings, UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRepository gameRepository, PrivacySettingValidator privacySettingValidator) {
        super(userRepository, walletService, provablyFairProvider, usageLimiter, gameRepository, privacySettingValidator);
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
            throw new BadRequestException("bet is required");
        }

        BigDecimal bet;
        try {
            bet = new BigDecimal(betStr);
        }
        catch (Exception e) {
            throw new BadRequestException("bet is not a number");
        }

        if (bet.compareTo(new BigDecimal(settings.getMinBet())) < 0) {
            throw new BadRequestException("insufficient bet");
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
