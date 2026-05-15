package com.example.phantom.game;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Random;

public abstract class GameService {

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final ProvablyFairProvider provablyFairProvider;
    private final UsageLimiter usageLimiter;
    private final GameRepository gameRepository;
    private final PrivacySettingValidator privacySettingValidator;

    protected GameService(UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRepository gameRepository, PrivacySettingValidator privacySettingValidator) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.provablyFairProvider = provablyFairProvider;
        this.usageLimiter = usageLimiter;
        this.gameRepository = gameRepository;
        this.privacySettingValidator = privacySettingValidator;
    }

    protected abstract GameSettings get();

    protected abstract GameType gameType();

    protected abstract Game initGame(Map<String, String> data);

    protected abstract BigDecimal runGame(Game round, Random random);

    @Transactional
    public GameInitRepresentation init(Long userId, GameInitRequest request) {
        User user = getUser(userId);
        Game round = initGame(request.getData());
        round.setUser(user);
        round.setServerSeed(provablyFairProvider.generateSeed());

        if (walletService.getBalance(userId).compareTo(round.getBet()) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        gameRepository.deleteActiveRound(userId, gameType());
        gameRepository.save(round);

        GameInitRepresentation representation = new GameInitRepresentation();
        representation.setServerHash(provablyFairProvider.generateHash(round.getServerSeed()));
        representation.setData(round.getData());
        return representation;
    }

    @Transactional
    public GameRepresentation run(Long userId, GameRunRequest request) {
        User user = getUser(userId);
        walletService.lock(userId);
        Game round = gameRepository.findActiveRound(userId, gameType()).orElseThrow(() -> new NotFoundException("game not found"));

        if (walletService.getBalance(userId).compareTo(round.getBet()) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        Random random = provablyFairProvider.fairRandom(round.getServerSeed(), request.getClientSeed());
        BigDecimal result = runGame(round, random);

        walletService.addChange(user, round.getBet().negate(), BalanceChangeType.GAME_BET, gameType().name());
        if (result.compareTo(BigDecimal.ZERO) > 0) {
            walletService.addChange(user, result, BalanceChangeType.GAME_WIN, gameType().name());
        }

        round.setClientSeed(request.getClientSeed());
        round.setResult(result);
        round.setTimestamp(Instant.now().getEpochSecond());
        gameRepository.save(round);

        return new GameRepresentation(round);
    }

    @Transactional
    public void delete(Long userId) {
        gameRepository.deleteActiveRound(userId, gameType());
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
