package com.example.phantom.game;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.user.PrivacySettingService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class GameStatService {

    private final UserRepository userRepository;
    private final GameRepository gameRepository;
    private final PrivacySettingService privacySettingService;
    private volatile PlatformGameStatRepresentation platformCache;

    public GameStatService(UserRepository userRepository, GameRepository gameRepository, PrivacySettingService privacySettingService) {
        this.userRepository = userRepository;
        this.gameRepository = gameRepository;
        this.privacySettingService = privacySettingService;
        this.platformCache = null;
    }

    public UserGameStatRepresentation getUserStats(Long userId, Long targetId) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingService.validate(user.getId(), target.getId(), target.getGameStatsPrivacySetting());

        Object[] raw = gameRepository.findCountAndMaxResult(null, target.getId()).stream().findFirst().orElseThrow(RuntimeException::new);

        return new UserGameStatRepresentation(
                (Long) raw [0],
                (BigDecimal) raw[1]
        );
    }

    public PlatformGameStatRepresentation getPlatformStats() {
        return platformCache;
    }

    public GameAnalyticsRepresentation getAnalytics(@AuthenticationPrincipal Long userId, Long since, Long before) {
        User user = requireChatModerator(userId);

        log.info("user {} requested analytics {} - {}", user.getId(), since, before);
        List<Object[]> raw = gameRepository.findGroupedByGameTypeCountAndBetsAndResults(since, before);

        Map<GameType, GameTypeAnalyticsRepresentation> map = new EnumMap<>(GameType.class);
        for (Object[] row : raw) {
            map.put((GameType) row[0], new GameTypeAnalyticsRepresentation((Long) row[1], (BigDecimal) row[2], (BigDecimal) row[3]));
        }

        return new GameAnalyticsRepresentation(map);
    }

    @Scheduled(fixedDelay = 60 * 1000)
    public void updatePlatformCache() {
        log.debug("updating game stat platform cache...");
        long since24h = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();

        Object[] rawAllTime = gameRepository.findCountAndMaxResult(null, null).stream().findFirst().orElseThrow(RuntimeException::new);
        Object[] rawSince24h = gameRepository.findCountAndMaxResult(since24h, null).stream().findFirst().orElseThrow(RuntimeException::new);

        platformCache = new PlatformGameStatRepresentation(
                (Long) rawAllTime[0],
                (Long) rawSince24h[0],
                (BigDecimal) rawAllTime[1],
                (BigDecimal) rawSince24h[1]
        );
    }

    private User requireAuthenticated(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private User requireChatModerator(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        if (!user.getRole().getChatModeratorAccess()) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return user;
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }
}
