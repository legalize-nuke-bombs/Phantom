package com.example.phantom.game.coinflip;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.game.*;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Random;

@Service
public class CoinFlipService extends GameService {

    private final CoinFlipSettings settings;

    public CoinFlipService(CoinFlipSettings settings, UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRepository gameRepository, PrivacySettingValidator privacySettingValidator) {
        super(userRepository, walletService, provablyFairProvider, usageLimiter, gameRepository, privacySettingValidator);
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
            throw new BadRequestException("bet is required");
        }

        BigDecimal bet;
        try {
            bet = new BigDecimal(betStr);
        }
        catch (Exception e) {
            throw new BadRequestException("bet is not a number");
        }

        if (bet.compareTo(settings.getMinimalBet()) < 0) {
            throw new BadRequestException("insufficient bet");
        }

        Game game = new Game();
        game.setGameType(GameType.COINFLIP);
        game.setBet(bet);
        game.setData(Map.of("possibleResult", bet.multiply(settings.getMultiplier()).toString()));
        return game;
    }

    @Override
    protected BigDecimal runGame(Game round, Random random) {
        return (random.nextInt() % 2 == 1)
                ? new BigDecimal(round.getData().get("possibleResult"))
                : BigDecimal.ZERO;
    }
}
