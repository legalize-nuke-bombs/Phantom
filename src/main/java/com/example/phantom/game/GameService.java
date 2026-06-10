package com.example.phantom.game;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.Experience;
import com.example.phantom.experience.ExperienceService;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.provablyfair.ProvablyFairService;
import com.example.phantom.ref.RefService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Map;
import java.util.Random;

public abstract class GameService {

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final ExperienceService experienceService;
    private final ProfileService profileService;
    private final ProvablyFairService provablyFairService;
    private final RefService refService;
    private final GameRepository gameRepository;

    protected GameService(UserRepository userRepository, WalletService walletService, ExperienceService experienceService, ProfileService profileService, RefService refService, ProvablyFairService provablyFairService, GameRepository gameRepository) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.experienceService = experienceService;
        this.profileService = profileService;
        this.provablyFairService = provablyFairService;
        this.refService = refService;
        this.gameRepository = gameRepository;
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
        game.setServerSeed(provablyFairService.generateSeed());
        if (game.getData() == null) game.setData(Map.of());

        if (walletService.getWallet(userId).getBalanceCached().compareTo(game.getBet()) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }

        gameRepository.deleteActiveGame(userId, gameType());
        gameRepository.save(game);

        GameInitRepresentation representation = new GameInitRepresentation();
        representation.setServerHash(provablyFairService.generateHash(game.getServerSeed()));
        representation.setData(game.getData());
        return representation;
    }

    @Transactional
    public GameRepresentation run(Long userId, GameRunRequest request) {
        User user = getUser(userId);
        Wallet wallet = walletService.lock(userId);
        Experience experience = experienceService.lock(userId);
        Game game = gameRepository.findActiveGame(userId, gameType()).orElseThrow(() -> new ApiException(ErrorCode.GAME_NOT_FOUND));

        if (wallet.getBalanceCached().compareTo(game.getBet()) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }

        Random random = provablyFairService.fairRandom(game.getServerSeed(), request.getClientSeed());
        game = runGame(game, random);
        BigDecimal result = game.getResult();

        walletService.addChange(wallet, game.getBet().negate());
        if (result.compareTo(BigDecimal.ZERO) > 0) {
            walletService.addChange(wallet, result);
        }

        experienceService.addChange(user,
                experience,
                game.getBet().multiply(new BigDecimal(100)).setScale(0, RoundingMode.DOWN).longValue(),
                ExperienceChangeType.BET,
                gameType().name()
        );

        refService.registerBet(user, game.getBet());

        game.setClientSeed(request.getClientSeed());
        game.setResult(result);
        game.setTimestamp(Instant.now().getEpochSecond());
        gameRepository.save(game);

        return new GameRepresentation(game, profileService.getCardForUser(userId, user));
    }

    @Transactional
    public void delete(Long userId) {
        gameRepository.deleteActiveGame(userId, gameType());
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }
}
