package com.example.phantom.stat;

import com.example.phantom.game.thecase.CaseGameLogRepository;
import com.example.phantom.game.upgrader.UpgraderGameLogRepository;
import com.example.phantom.ton.TonTransferStatus;
import com.example.phantom.ton.withdrawal.TonWithdrawalRepository;
import com.example.phantom.user.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

@Service
public class StatService {

    private final StatRepresentation cache;

    private final UpgraderGameLogRepository upgraderGameLogRepository;
    private final CaseGameLogRepository caseGameLogRepository;
    private final TonWithdrawalRepository tonWithdrawalRepository;
    private final UserRepository userRepository;

    public StatService(UpgraderGameLogRepository upgraderGameLogRepository, CaseGameLogRepository caseGameLogRepository, TonWithdrawalRepository tonWithdrawalRepository, UserRepository userRepository) {
        this.cache = new StatRepresentation();

        this.upgraderGameLogRepository = upgraderGameLogRepository;
        this.caseGameLogRepository = caseGameLogRepository;
        this.tonWithdrawalRepository = tonWithdrawalRepository;
        this.userRepository = userRepository;
    }

    public StatRepresentation get() {
        return this.cache;
    }

    @Scheduled(fixedDelay = 1000)
    public void updateCache() {
        Long timestamp24 = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();

        cache.setUpgraderGames(upgraderGameLogRepository.count());
        cache.setUpgraderGamesToday(upgraderGameLogRepository.countSinceTimestamp(timestamp24));
        cache.setUpgraderMaxResult(upgraderGameLogRepository.maxResult());
        if (cache.getUpgraderMaxResult() == null) cache.setUpgraderMaxResult(BigDecimal.ZERO);

        cache.setCaseGames(caseGameLogRepository.count());
        cache.setCaseGamesToday(caseGameLogRepository.countSinceTimestamp(timestamp24));
        cache.setCaseMaxResult(caseGameLogRepository.maxResult());
        if (cache.getCaseMaxResult() == null) cache.setCaseMaxResult(BigDecimal.ZERO);

        cache.setTonWithdrawals(tonWithdrawalRepository.sumByStatus(TonTransferStatus.CONFIRMED));
        cache.setTonWithdrawalsToday(tonWithdrawalRepository.sumByStatusSinceTimestamp(TonTransferStatus.CONFIRMED, timestamp24));
        if (cache.getTonWithdrawals() == null) cache.setTonWithdrawals(BigDecimal.ZERO);
        if (cache.getTonWithdrawalsToday() == null) cache.setTonWithdrawalsToday(BigDecimal.ZERO);

        cache.setUsers(userRepository.count());
    }

}
