package com.example.phantom.game;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.user.PrivacySettingService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

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

        return new UserGameStatRepresentation(
                gameRepository.countCompletedByUserId(target.getId()),
                gameRepository.maxResultByUserId(target.getId()));
    }

    public PlatformGameStatRepresentation getPlatformStats() {
        return platformCache;
    }

    @Scheduled(fixedDelay = 60 * 1000)
    public void updatePlatformCache() {
        log.debug("updating game stat platform cache...");
        long since24h = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();
        platformCache = new PlatformGameStatRepresentation(
                gameRepository.countCompleted(),
                gameRepository.countCompletedSince(since24h),
                gameRepository.maxResult(),
                gameRepository.maxResultSince(since24h)
        );
    }

    private User requireAuthenticated(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }
}
