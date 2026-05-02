package com.example.phantom.game.upgrader;

import com.example.phantom.exception.*;
import com.example.phantom.game.util.GameRunRequest;
import com.example.phantom.game.util.ProvablyFairProvider;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.Random;

@Service
public class UpgraderService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final UpgraderGameRepository upgraderGameRepository;

    private final ProvablyFairProvider provablyFairProvider;

    private final UpgraderSettings settings;

    public UpgraderService(UserRepository userRepository, WalletRepository walletRepository, UpgraderGameRepository upgraderGameRepository, ProvablyFairProvider provablyFairProvider) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.upgraderGameRepository = upgraderGameRepository;

        this.provablyFairProvider = provablyFairProvider;

        this.settings = new UpgraderSettings();
    }

    public UpgraderSettings get() {
        return settings;
    }

    @Transactional
    public UpgraderInitRepresentation init(Long userId, UpgraderInitRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        Wallet wallet = walletRepository.findByUserId(userId).orElseThrow(() -> new NotFoundException("wallet not found"));

        BigDecimal bet = request.getBet();
        Integer successPercent = request.getSuccessPercent();

        validateBetBigEnough(bet);
        validateEnoughMoney(wallet, bet);

        BigDecimal multiplier = getMultiplier(successPercent);

        if (upgraderGameRepository.existsById(userId)) {
            upgraderGameRepository.deleteById(userId);
        }

        UpgraderGame upgrader = new UpgraderGame();
        upgrader.setUser(user);
        upgrader.setBet(bet);
        upgrader.setSuccessPercent(successPercent);
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
    public UpgraderRunRepresentation run(Long userId, GameRunRequest request) {
        Wallet wallet = walletRepository.findByUserIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
        UpgraderGame upgraderGame = upgraderGameRepository.findById(userId).orElseThrow(() -> new NotFoundException("upgrader game not found"));

        String clientSeed = request.getClientSeed();

        String serverSeed = upgraderGame.getServerSeed();
        BigDecimal bet = upgraderGame.getBet();
        Integer successPercent = upgraderGame.getSuccessPercent();
        BigDecimal possibleResult = upgraderGame.getPossibleResult();

        validateEnoughMoney(wallet, bet);

        Random fairRandom = provablyFairProvider.fairRandom(serverSeed, clientSeed);

        int percent = fairRandom.nextInt(100) + 1;
        boolean won = successPercent >= percent;

        UpgraderRunRepresentation representation = new UpgraderRunRepresentation();
        representation.setWon(won);
        representation.setPercent(percent);
        representation.setServerSeed(serverSeed);

        wallet.setBalance(wallet.getBalance().subtract(bet));
        if (won) {
            wallet.setBalance(wallet.getBalance().add(possibleResult));
        }

        walletRepository.save(wallet);
        upgraderGameRepository.delete(upgraderGame);

        return representation;
    }

    private BigDecimal getMultiplier(Integer successPercent) {
        BigDecimal multiplier = settings.getPercents().get(successPercent);
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
