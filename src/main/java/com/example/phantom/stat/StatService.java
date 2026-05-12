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

    private final PlatformStatRepresentation platformStatCache;

    private final UpgraderGameLogRepository upgraderGameLogRepository;
    private final CaseGameLogRepository caseGameLogRepository;
    private final TonWithdrawalRepository tonWithdrawalRepository;
    private final UserRepository userRepository;

    public StatService(UpgraderGameLogRepository upgraderGameLogRepository, CaseGameLogRepository caseGameLogRepository, TonWithdrawalRepository tonWithdrawalRepository, UserRepository userRepository) {
        this.platformStatCache = new PlatformStatRepresentation();

        this.upgraderGameLogRepository = upgraderGameLogRepository;
        this.caseGameLogRepository = caseGameLogRepository;
        this.tonWithdrawalRepository = tonWithdrawalRepository;
        this.userRepository = userRepository;
    }

    public PlatformStatRepresentation get() {
        return this.platformStatCache;
    }

    public PersonalStatRepresentation getByUserId(Long userId) {
        PersonalStatRepresentation representation = new PersonalStatRepresentation();

        representation.setUpgraderGames(upgraderGameLogRepository.countByUserId(userId));
        representation.setUpgradeGameMaxResult(upgraderGameLogRepository.maxResultByUserId(userId));
        if (representation.getUpgradeGameMaxResult() == null) representation.setUpgradeGameMaxResult(BigDecimal.ZERO);

        representation.setCaseGames(caseGameLogRepository.countByUserId(userId));
        representation.setCaseGameMaxResult(caseGameLogRepository.maxResultByUserId(userId));
        if (representation.getCaseGameMaxResult() == null) representation.setCaseGameMaxResult(BigDecimal.ZERO);

        return representation;
    }

    @Scheduled(fixedDelay = 1000)
    public void updatePlatformStatCache() {
        Long timestamp24 = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();

        platformStatCache.setUpgraderGames(upgraderGameLogRepository.count());
        platformStatCache.setUpgraderGamesToday(upgraderGameLogRepository.countSinceTimestamp(timestamp24));
        platformStatCache.setUpgraderMaxResult(upgraderGameLogRepository.maxResult());
        if (platformStatCache.getUpgraderMaxResult() == null) platformStatCache.setUpgraderMaxResult(BigDecimal.ZERO);

        platformStatCache.setCaseGames(caseGameLogRepository.count());
        platformStatCache.setCaseGamesToday(caseGameLogRepository.countSinceTimestamp(timestamp24));
        platformStatCache.setCaseMaxResult(caseGameLogRepository.maxResult());
        if (platformStatCache.getCaseMaxResult() == null) platformStatCache.setCaseMaxResult(BigDecimal.ZERO);

        platformStatCache.setTonWithdrawals(tonWithdrawalRepository.sumByStatus(TonTransferStatus.CONFIRMED));
        platformStatCache.setTonWithdrawalsToday(tonWithdrawalRepository.sumByStatusSinceTimestamp(TonTransferStatus.CONFIRMED, timestamp24));
        if (platformStatCache.getTonWithdrawals() == null) platformStatCache.setTonWithdrawals(BigDecimal.ZERO);
        if (platformStatCache.getTonWithdrawalsToday() == null) platformStatCache.setTonWithdrawalsToday(BigDecimal.ZERO);

        platformStatCache.setUsers(userRepository.count());
    }

}
