package com.example.phantom.game.thecase;

import com.example.phantom.exception.*;
import com.example.phantom.game.util.GameInitRepresentation;
import com.example.phantom.game.util.GameRunRequest;
import com.example.phantom.game.util.ProvablyFairProvider;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
import com.example.phantom.wallet.WalletService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Random;

@Service
public class CaseService {

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final CaseGameRepository caseGameRepository;
    private final CaseGameLogRepository caseGameLogRepository;

    private final ProvablyFairProvider provablyFairProvider;
    private final CaseSettings settings;
    private final UsageLimiter usageLimiter;

    public CaseService(UserRepository userRepository, WalletService walletService, CaseGameRepository caseGameRepository, CaseGameLogRepository caseGameLogRepository, ProvablyFairProvider provablyFairProvider, CaseSettings settings, UsageLimiter usageLimiter) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.caseGameRepository = caseGameRepository;
        this.caseGameLogRepository = caseGameLogRepository;

        this.provablyFairProvider = provablyFairProvider;
        this.settings = settings;
        this.usageLimiter = usageLimiter;
    }

    public CaseSettings get() {
        return settings;
    }

    @Transactional
    public GameInitRepresentation init(Long userId, CaseInitRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        String caseName = request.getCaseName();

        Case thecase = findCase(caseName);

        validateEnoughMoney(userId, thecase);

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
    public CaseGameLogRepresentation run(Long userId, GameRunRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        walletService.lock(userId);
        CaseGame caseGame = caseGameRepository.findById(userId).orElseThrow(() -> new NotFoundException("case game not found"));

        String clientSeed = request.getClientSeed();

        String caseName = caseGame.getCaseName();
        String serverSeed = caseGame.getServerSeed();

        Case thecase = findCase(caseName);

        validateEnoughMoney(userId, thecase);

        Random random = provablyFairProvider.fairRandom(serverSeed, clientSeed);
        int caseIndex = random.nextInt(thecase.getSize());
        BigDecimal result = thecase.get(caseIndex);

        walletService.addChange(user, thecase.getCost().negate(), BalanceChangeType.CASE_BET);
        walletService.addChange(user, result, BalanceChangeType.CASE_WIN);

        caseGameRepository.delete(caseGame);

        CaseGameLog caseGameLog = new CaseGameLog();
        caseGameLog.setUser(user);
        caseGameLog.setTimestamp(Instant.now().getEpochSecond());
        caseGameLog.setCaseName(caseName);
        caseGameLog.setResult(result);
        caseGameLog.setServerSeed(serverSeed);
        caseGameLog.setClientSeed(clientSeed);
        caseGameLog = caseGameLogRepository.save(caseGameLog);

        return new CaseGameLogRepresentation(caseGameLog);
    }

    public List<CaseGameLogRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<CaseGameLog> logs = before != null
                ? caseGameLogRepository.findByUserIdBeforePageable(userId, before, pageable)
                : caseGameLogRepository.findByUserIdPageable(userId, pageable);

        return logs.stream().map(CaseGameLogRepresentation::new).toList();
    }

    private void validateEnoughMoney(Long userId, Case thecase) {
        if (walletService.getBalance(userId).compareTo(thecase.getCost()) < 0) {
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
