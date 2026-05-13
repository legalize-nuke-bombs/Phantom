package com.example.phantom.game;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
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
import java.util.Random;

public abstract class AbstractGameService {

    protected final UserRepository userRepository;
    protected final WalletService walletService;
    protected final ProvablyFairProvider provablyFairProvider;
    protected final UsageLimiter usageLimiter;
    protected final GameRoundRepository gameRoundRepository;

    protected AbstractGameService(UserRepository userRepository, WalletService walletService, ProvablyFairProvider provablyFairProvider, UsageLimiter usageLimiter, GameRoundRepository gameRoundRepository) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.provablyFairProvider = provablyFairProvider;
        this.usageLimiter = usageLimiter;
        this.gameRoundRepository = gameRoundRepository;
    }

    protected abstract GameType gameType();

    protected abstract BigDecimal play(GameRound round, Random random);

    protected void deleteActiveIfExists(Long userId) {
        gameRoundRepository.findActiveRound(userId, gameType()).ifPresent(gameRoundRepository::delete);
    }

    @Transactional
    public void delete(Long userId) {
        GameRound round = gameRoundRepository.findActiveRound(userId, gameType()).orElseThrow(() -> new NotFoundException("game not found"));
        gameRoundRepository.delete(round);
    }

    @Transactional
    public GameRoundRepresentation run(Long userId, GameRunRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        walletService.lock(userId);
        GameRound round = gameRoundRepository.findActiveRound(userId, gameType()).orElseThrow(() -> new NotFoundException("game not found"));

        if (walletService.getBalance(userId).compareTo(round.getBet()) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        Random random = provablyFairProvider.fairRandom(round.getServerSeed(), request.getClientSeed());
        BigDecimal result = play(round, random);

        walletService.addChange(user, round.getBet().negate(), BalanceChangeType.GAME_BET);
        if (result.compareTo(BigDecimal.ZERO) > 0) {
            walletService.addChange(user, result, BalanceChangeType.GAME_WIN);
        }

        round.setClientSeed(request.getClientSeed());
        round.setResult(result);
        round.setTimestamp(Instant.now().getEpochSecond());
        gameRoundRepository.save(round);

        return new GameRoundRepresentation(round);
    }

    public List<GameRoundRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<GameRound> rounds = before != null
                ? gameRoundRepository.findHistoryBefore(userId, gameType(), before, pageable)
                : gameRoundRepository.findHistory(userId, gameType(), pageable);

        return rounds.stream().map(GameRoundRepresentation::new).toList();
    }
}
