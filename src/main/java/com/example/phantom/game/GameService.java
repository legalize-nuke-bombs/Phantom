package com.example.phantom.game;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.experience.ExperienceService;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Random;

public abstract class GameService {

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final ExperienceService experienceService;
    private final ProvablyFairProvider provablyFairProvider;
    private final UsageLimiter usageLimiter;
    private final GameRepository gameRepository;
    private final PrivacySettingValidator privacySettingValidator;

    protected GameService(UserRepository userRepository, WalletService walletService, ExperienceService experienceService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRepository gameRepository, PrivacySettingValidator privacySettingValidator) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.experienceService = experienceService;
        this.provablyFairProvider = provablyFairProvider;
        this.usageLimiter = usageLimiter;
        this.gameRepository = gameRepository;
        this.privacySettingValidator = privacySettingValidator;
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
        game.setServerSeed(provablyFairProvider.generateSeed());
        if (game.getData() == null) game.setData(Map.of());

        if (walletService.getWallet(userId).getBalanceCached().compareTo(game.getBet()) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        gameRepository.deleteActiveGame(userId, gameType());
        gameRepository.save(game);

        GameInitRepresentation representation = new GameInitRepresentation();
        representation.setServerHash(provablyFairProvider.generateHash(game.getServerSeed()));
        representation.setData(game.getData());
        return representation;
    }

    @Transactional
    public GameRepresentation run(Long userId, GameRunRequest request) {
        User user = getUser(userId);
        Wallet wallet = walletService.lock(userId);
        experienceService.lock(userId);
        Game game = gameRepository.findActiveGame(userId, gameType()).orElseThrow(() -> new NotFoundException("game not found"));

        if (wallet.getBalanceCached().compareTo(game.getBet()) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        Random random = provablyFairProvider.fairRandom(game.getServerSeed(), request.getClientSeed());
        game = runGame(game, random);
        BigDecimal result = game.getResult();

        walletService.addChange(user, wallet, game.getBet().negate(), BalanceChangeType.GAME_BET, gameType().name());
        if (result.compareTo(BigDecimal.ZERO) > 0) {
            walletService.addChange(user, wallet, result, BalanceChangeType.GAME_WIN, gameType().name());
        }

        experienceService.addChange(user, game.getBet().multiply(new BigDecimal(100)).setScale(0, RoundingMode.DOWN).longValue(), ExperienceChangeType.BET, gameType().name());

        game.setClientSeed(request.getClientSeed());
        game.setResult(result);
        game.setTimestamp(Instant.now().getEpochSecond());
        gameRepository.save(game);

        return new GameRepresentation(game);
    }

    @Transactional
    public void delete(Long userId) {
        gameRepository.deleteActiveGame(userId, gameType());
    }

    public List<GameRepresentation> getGameUserHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = getUser(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getGameHistoryPrivacySetting());

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<Game> rounds = before != null
                ? gameRepository.findHistoryByUserAndGameTypeBefore(target.getId(), gameType(), before, pageable)
                : gameRepository.findHistoryByUserAndGameType(target.getId(), gameType(), pageable);

        return rounds.stream().map(GameRepresentation::new).toList();
    }

    public UserGameStatRepresentation getGameUserStats(Long userId, Long targetId) {
        User user = getUser(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getGameStatsPrivacySetting());

        return new UserGameStatRepresentation(
                gameRepository.countCompletedByUserIdAndGameType(targetId, gameType()),
                gameRepository.maxResultByUserIdAndGameType(targetId, gameType())
        );
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }
}
