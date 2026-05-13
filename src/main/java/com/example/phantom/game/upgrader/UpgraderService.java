package com.example.phantom.game.upgrader;

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
import java.util.Random;

@Service
public class UpgraderService extends AbstractGameService {

    private final UpgraderSettings settings;

    public UpgraderService(UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRoundRepository gameRoundRepository, UpgraderSettings settings) {
        super(userRepository, walletService, provablyFairProvider, usageLimiter, gameRoundRepository);
        this.settings = settings;
    }

    @Override
    protected GameType gameType() { return GameType.UPGRADER; }

    @Override
    protected BigDecimal play(GameRound round, Random random) {
        int percent = Integer.parseInt(round.getData().get("percent"));
        int randomResult = random.nextInt(100) + 1;
        return percent >= randomResult ? new BigDecimal(round.getData().get("possibleResult")) : BigDecimal.ZERO;
    }

    public UpgraderSettings get() {
        return settings;
    }

    @Transactional
    public GameInitRepresentation init(Long userId, UpgraderInitRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        BigDecimal bet = request.getBet();
        Integer percent = request.getPercent();

        if (bet.compareTo(settings.getMinimalBet()) < 0) {
            throw new BadRequestException("insufficient bet");
        }
        if (walletService.getBalance(userId).compareTo(bet) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        BigDecimal multiplier = settings.getPercents().get(percent);
        if (multiplier == null) {
            throw new BadRequestException("option not available");
        }

        deleteActiveIfExists(userId);

        BigDecimal possibleResult = bet.multiply(multiplier);

        GameRound round = new GameRound();
        round.setUser(user);
        round.setGameType(GameType.UPGRADER);
        round.setBet(bet);
        round.setServerSeed(provablyFairProvider.generateSeed());
        round.setData(Map.of("percent", percent.toString(), "possibleResult", possibleResult.toPlainString()));
        gameRoundRepository.save(round);

        GameInitRepresentation representation = new GameInitRepresentation();
        representation.setServerHash(provablyFairProvider.generateHash(round.getServerSeed()));
        representation.setPossibleResult(possibleResult);
        return representation;
    }
}
