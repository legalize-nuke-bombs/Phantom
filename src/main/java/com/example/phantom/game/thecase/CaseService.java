package com.example.phantom.game.thecase;

import com.example.phantom.exception.*;
import com.example.phantom.game.util.GameInitRepresentation;
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
import java.util.Objects;
import java.util.Random;

@Service
public class CaseService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;

    private final ProvablyFairProvider provablyFairProvider;
    private final CaseSettings settings;
    private final CaseGameRepository caseGameRepository;

    public CaseService(UserRepository userRepository, WalletRepository walletRepository, ProvablyFairProvider provablyFairProvider, CaseGameRepository caseGameRepository) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;

        this.provablyFairProvider = provablyFairProvider;
        this.settings = new CaseSettings();
        this.caseGameRepository = caseGameRepository;
    }

    public CaseSettings get() {
        return settings;
    }

    @Transactional
    public GameInitRepresentation init(Long userId, CaseInitRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        Wallet wallet = walletRepository.findByUserId(userId).orElseThrow(() -> new NotFoundException("wallet not found"));

        String caseName = request.getCaseName();

        Case thecase = findCase(caseName);

        validateEnoughMoney(wallet, thecase);

        String serverSeed = provablyFairProvider.generateSeed();

        CaseGame caseGame = new CaseGame();
        caseGame.setUser(user);
        caseGame.setCaseName(caseName);
        caseGame.setServerSeed(serverSeed);
        if (caseGameRepository.existsById(userId)) {
            caseGameRepository.deleteById(userId);
        }
        caseGameRepository.save(caseGame);

        GameInitRepresentation representation = new GameInitRepresentation();
        representation.setServerHash(provablyFairProvider.generateHash(serverSeed));
        return representation;
    }

    @Transactional
    public void delete(Long userId) {
        try {
            caseGameRepository.deleteById(userId);
        }
        catch (DataIntegrityViolationException e) {
            throw new NotFoundException("case game not found");
        }
    }

    @Transactional
    public CaseRunRepresentation run(Long userId, GameRunRequest request) {
        Wallet wallet = walletRepository.findByUserIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
        CaseGame caseGame = caseGameRepository.findById(userId).orElseThrow(() -> new NotFoundException("case game not found"));

        String clientSeed = request.getClientSeed();

        String caseName = caseGame.getCaseName();
        String serverSeed = caseGame.getServerSeed();

        Case thecase = findCase(caseName);

        validateEnoughMoney(wallet, thecase);

        Random random = provablyFairProvider.fairRandom(serverSeed, clientSeed);
        int caseIndex = random.nextInt(thecase.getSize());
        BigDecimal result = thecase.get(caseIndex);

        wallet.setBalance(wallet.getBalance().subtract(thecase.getCost()).add(result));
        walletRepository.save(wallet);

        caseGameRepository.delete(caseGame);

        CaseRunRepresentation representation = new CaseRunRepresentation();
        representation.setResult(result);
        representation.setCaseIndex(caseIndex);
        representation.setServerSeed(serverSeed);
        return representation;
    }

    private void validateEnoughMoney(Wallet wallet, Case thecase) {
        if (wallet.getBalance().compareTo(thecase.getCost()) < 0) {
            throw new BadRequestException("insufficient balance");
        }
    }

    private Case findCase(String caseName) {
        for (Case thecase : settings.getCases()) {
            if (Objects.equals(thecase.getName(), caseName)) {
                return thecase;
            }
        }
        throw new BadRequestException("invalid caseName");
    }
}
