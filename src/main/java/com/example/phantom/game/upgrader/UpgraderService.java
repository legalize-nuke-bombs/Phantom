package com.example.phantom.game.upgrader;

import com.example.phantom.exception.*;
import com.example.phantom.game.util.GameRunRequest;
import com.example.phantom.game.util.ProvablyFairProvider;
import com.example.phantom.ratelimit.RateLimitReached;
import com.example.phantom.ratelimit.RateLimiter;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Random;

@Service
public class UpgraderService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final UpgraderGameRepository upgraderGameRepository;
    private final UpgraderGameLogRepository upgraderGameLogRepository;

    private final ProvablyFairProvider provablyFairProvider;
    private final RateLimiter rateLimiter;
    private final UpgraderSettings settings;

    public UpgraderService(UserRepository userRepository, WalletRepository walletRepository, UpgraderGameRepository upgraderGameRepository, UpgraderGameLogRepository upgraderGameLogRepository, ProvablyFairProvider provablyFairProvider, RateLimiter rateLimiter, UpgraderSettings settings) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.upgraderGameRepository = upgraderGameRepository;
        this.upgraderGameLogRepository = upgraderGameLogRepository;

        this.provablyFairProvider = provablyFairProvider;
        this.rateLimiter = rateLimiter;
        this.settings = settings;
    }

    public UpgraderSettings get() {
        return settings;
    }

    @Transactional
    public UpgraderInitRepresentation init(Long userId, UpgraderInitRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        Wallet wallet = walletRepository.findById(userId).orElseThrow(() -> new NotFoundException("wallet not found"));

        BigDecimal bet = request.getBet();
        Integer percent = request.getPercent();

        validateBetBigEnough(bet);
        validateEnoughMoney(wallet, bet);

        BigDecimal multiplier = getMultiplier(percent);

        if (upgraderGameRepository.existsById(userId)) {
            upgraderGameRepository.deleteById(userId);
        }

        UpgraderGame upgrader = new UpgraderGame();
        upgrader.setUser(user);
        upgrader.setBet(bet);
        upgrader.setPercent(percent);
        upgrader.setPossibleResult(bet.multiply(multiplier));
        upgrader.setServerSeed(provablyFairProvider.generateSeed());
        upgrader = upgraderGameRepository.save(upgrader);

        UpgraderInitRepresentation representation = new UpgraderInitRepresentation();
        representation.setPossibleResult(upgrader.getPossibleResult());
        representation.setServerHash(provablyFairProvider.generateHash(upgrader.getServerSeed()));
        return representation;
    }

    @Transactional
    public void delete(Long userId) {
        try {
            upgraderGameRepository.deleteById(userId);
        }
        catch (DataIntegrityViolationException e) {
            throw new NotFoundException("upgrader game not found");
        }
    }

    @Transactional
    public UpgraderGameLogRepresentation run(Long userId, GameRunRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        Wallet wallet = walletRepository.findByIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
        UpgraderGame upgraderGame = upgraderGameRepository.findById(userId).orElseThrow(() -> new NotFoundException("upgrader game not found"));

        String clientSeed = request.getClientSeed();

        String serverSeed = upgraderGame.getServerSeed();
        BigDecimal bet = upgraderGame.getBet();
        Integer percent = upgraderGame.getPercent();
        BigDecimal possibleResult = upgraderGame.getPossibleResult();

        validateEnoughMoney(wallet, bet);

        Random fairRandom = provablyFairProvider.fairRandom(serverSeed, clientSeed);

        int randomResult = fairRandom.nextInt(100) + 1;
        boolean won = percent >= randomResult;

        UpgraderGameLog upgraderGameLog = new UpgraderGameLog();
        upgraderGameLog.setUser(user);
        upgraderGameLog.setTimestamp(Instant.now().getEpochSecond());
        upgraderGameLog.setBet(bet);
        upgraderGameLog.setPercent(percent);
        upgraderGameLog.setServerSeed(serverSeed);
        upgraderGameLog.setClientSeed(clientSeed);

        wallet.setBalance(wallet.getBalance().subtract(bet));
        if (won) {
            wallet.setBalance(wallet.getBalance().add(possibleResult));
            upgraderGameLog.setResult(possibleResult);
        }
        else {
            upgraderGameLog.setResult(BigDecimal.ZERO);
        }

        walletRepository.save(wallet);

        upgraderGameRepository.delete(upgraderGame);

        upgraderGameLog = upgraderGameLogRepository.save(upgraderGameLog);

        return new UpgraderGameLogRepresentation(upgraderGameLog);
    }

    public List<UpgraderGameLogRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        try { rateLimiter.startAction(user, "pagination", Long.valueOf(limit)); }
        catch (RateLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<UpgraderGameLog> logs = before != null
                ? upgraderGameLogRepository.findByUserIdBeforePageable(userId, before, pageable)
                : upgraderGameLogRepository.findByUserIdPageable(userId, pageable);

        return logs.stream().map(UpgraderGameLogRepresentation::new).toList();
    }

    private BigDecimal getMultiplier(Integer percent) {
        BigDecimal multiplier = settings.getPercents().get(percent);
        if (multiplier == null) {
            throw new BadRequestException("option not available");
        }
        return multiplier;
    }

    private void validateBetBigEnough(BigDecimal bet) {
        if (bet.compareTo(settings.getMinimalBet()) < 0) {
            throw new BadRequestException("insufficient bet");
        }
    }

    private void validateEnoughMoney(Wallet wallet, BigDecimal bet) {
        if (wallet.getBalance().compareTo(bet) < 0) {
            throw new BadRequestException("insufficient balance");
        }
    }
}
