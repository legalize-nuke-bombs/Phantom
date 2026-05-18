package com.example.phantom.game.fruits;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.experience.ExperienceService;
import com.example.phantom.game.*;
import com.example.phantom.game.util.slot.SpinRepresentation;
import com.example.phantom.privacysetting.PrivacySettingRepository;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.privacysetting.PrivacyParamValidator;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Random;

@Service
public class FruitService extends GameService {

    private final FruitSettings settings;

    protected FruitService(FruitSettings settings, UserRepository userRepository, PrivacySettingRepository privacySettingRepository, WalletService walletService, ExperienceService experienceService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRepository gameRepository, PrivacyParamValidator privacySettingValidator) {
        super(userRepository, privacySettingRepository, walletService, experienceService, provablyFairProvider, usageLimiter, gameRepository, privacySettingValidator);
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
