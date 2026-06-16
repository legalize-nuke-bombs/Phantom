package com.example.phantom.game;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.Experience;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
import com.example.phantom.user.User;
import com.example.phantom.wallet.Wallet;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Map;
import java.util.Random;

public abstract class GameService {

    protected final GameDependencies deps;

    protected GameService(GameDependencies deps) {
        this.deps = deps;
    }

    protected abstract GameSettings get();

    protected abstract GameType gameType();

    protected abstract Game initGame(Map<String, String> data);

    protected abstract Game runGame(Game game, Random random);

    @Transactional
    public GameInitRepresentation init(Long userId, GameInitRequest request) {
        User user = getUser(userId);
        Game game = initGame(request.getData());
        game.setGameType(gameType());
        game.setUser(user);
        game.setServerSeed(deps.provablyFairService.generateSeed());
        if (game.getData() == null) game.setData(Map.of());

        if (deps.walletService.getWallet(userId).getBalanceCached().compareTo(game.getBet()) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }

        deps.gameRepository.deleteActiveGame(userId, gameType());
        deps.gameRepository.save(game);

        GameInitRepresentation representation = new GameInitRepresentation();
        representation.setServerHash(deps.provablyFairService.generateHash(game.getServerSeed()));
        representation.setData(game.getData());
        return representation;
    }

    @Transactional
    public GameRepresentation run(Long userId, GameRunRequest request) {
        User user = getUser(userId);
        Wallet wallet = deps.walletService.lock(userId);
        Game game = deps.gameRepository.findActiveGame(userId, gameType()).orElseThrow(() -> new ApiException(ErrorCode.GAME_NOT_FOUND));

        if (wallet.getBalanceCached().compareTo(game.getBet()) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }

        Random random = deps.provablyFairService.fairRandom(game.getServerSeed(), request.getClientSeed());
        game = runGame(game, random);
        BigDecimal result = game.getResult();

        deps.walletService.addChange(wallet, game.getBet().negate());
        if (result.compareTo(BigDecimal.ZERO) > 0) {
            deps.walletService.addChange(wallet, result);
        }

        deps.experienceService.addChange(user,
                game.getBet().multiply(new BigDecimal(100)).setScale(0, RoundingMode.DOWN).longValue(),
                ExperienceChangeType.BET,
                gameType().name()
        );

        deps.refService.registerBet(user, game.getBet());

        game.setClientSeed(request.getClientSeed());
        game.setResult(result);
        game.setTimestamp(Instant.now().getEpochSecond());
        deps.gameRepository.save(game);

        return new GameRepresentation(game);
    }

    @Transactional
    public void delete(Long userId) {
        deps.gameRepository.deleteActiveGame(userId, gameType());
    }

    private User getUser(Long userId) {
        return deps.userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }
}
