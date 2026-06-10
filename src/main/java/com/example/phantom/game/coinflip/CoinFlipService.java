package com.example.phantom.game.coinflip;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.ExperienceService;
import com.example.phantom.game.*;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.provablyfair.ProvablyFairService;
import com.example.phantom.ref.RefService;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Random;

@Service
public class CoinFlipService extends GameService {

    private final CoinFlipSettings settings;

    protected CoinFlipService(CoinFlipSettings settings, UserRepository userRepository, WalletService walletService, ExperienceService experienceService, ProfileService profileService, RefService refService, ProvablyFairService provablyFairService, GameRepository gameRepository) {
        super(userRepository, walletService, experienceService, profileService, refService, provablyFairService, gameRepository);
        this.settings = settings;
    }

    @Override
    public GameSettings get() {
        return settings;
    }

    @Override
    protected GameType gameType() {
        return GameType.COINFLIP;
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

        if (bet.compareTo(settings.getMinimalBet()) < 0) {
            throw new ApiException(ErrorCode.INVALID_BET);
        }

        Game game = new Game();
        game.setBet(bet);
        game.setData(Map.of("possibleResult", bet.multiply(settings.getMultiplier()).toString()));
        return game;
    }

    @Override
    protected Game runGame(Game game, Random random) {
        game.setResult(
                (random.nextInt() % 2 == 1)
                ? new BigDecimal(game.getData().get("possibleResult").toString())
                : BigDecimal.ZERO
        );
        return game;
    }
}
