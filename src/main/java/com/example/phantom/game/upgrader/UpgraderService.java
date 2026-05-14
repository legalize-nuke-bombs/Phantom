package com.example.phantom.game.upgrader;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.game.*;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Random;

@Service
public class UpgraderService extends GameService {

    private final UpgraderSettings settings;

    public UpgraderService(UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRepository gameRepository, UpgraderSettings settings) {
        super(userRepository, walletService, provablyFairProvider, usageLimiter, gameRepository);
        this.settings = settings;
    }

    public UpgraderSettings get() {
        return settings;
    }

    @Override
    protected GameType gameType() { return GameType.UPGRADER; }

    @Override
    protected Game initGame(Map<String, String> data) {
        String betStr = data.get("bet");
        String percentStr = data.get("percent");
        if (betStr == null || percentStr == null) {
            throw new BadRequestException("bet and percent are required");
        }

        BigDecimal bet;
        int percent;
        try {
            bet = new BigDecimal(betStr);
            percent = Integer.parseInt(percentStr);
        }
        catch (NumberFormatException e) {
            throw new BadRequestException("invalid bet or percent");
        }

        if (bet.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("bet must be positive");
        }
        if (bet.compareTo(settings.getMinimalBet()) < 0) {
            throw new BadRequestException("insufficient bet");
        }

        BigDecimal multiplier = settings.getPercents().get(percent);
        if (multiplier == null) {
            throw new BadRequestException("option not available");
        }

        Game round = new Game();
        round.setGameType(GameType.UPGRADER);
        round.setBet(bet);
        round.setData(Map.of("percent", String.valueOf(percent), "possibleResult", bet.multiply(multiplier).toPlainString()));
        return round;
    }

    @Override
    protected BigDecimal runGame(Game round, Random random) {
        int percent = Integer.parseInt(round.getData().get("percent"));
        int randomResult = random.nextInt(100) + 1;
        return percent >= randomResult ? new BigDecimal(round.getData().get("possibleResult")) : BigDecimal.ZERO;
    }
}
