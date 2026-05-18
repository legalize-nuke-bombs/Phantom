package com.example.phantom.game;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.privacysetting.PrivacyParam;
import com.example.phantom.privacysetting.PrivacySetting;
import com.example.phantom.privacysetting.PrivacySettingRepository;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.privacysetting.PrivacyParamValidator;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class GameHistoryStatService {

    private final UserRepository userRepository;
    private final PrivacySettingRepository privacySettingRepository;
    private final GameRepository gameRepository;
    private final UsageLimiter usageLimiter;
    private final PrivacyParamValidator privacySettingValidator;

    public GameHistoryStatService(UserRepository userRepository, PrivacySettingRepository privacySettingRepository, GameRepository gameRepository, UsageLimiter usageLimiter, PrivacyParamValidator privacySettingValidator) {
        this.userRepository = userRepository;
        this.privacySettingRepository = privacySettingRepository;
        this.gameRepository = gameRepository;
        this.usageLimiter = usageLimiter;
        this.privacySettingValidator = privacySettingValidator;
    }

    public List<GameRepresentation> getUserHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = getUser(userId);
        User target = getUser(targetId);
        PrivacySetting targetPrivacySetting = getPrivacySetting(target.getId());

        privacySettingValidator.validate(user.getId(), target.getId(), targetPrivacySetting.getGameHistoryPrivacyParam());

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<Game> games = before != null
                ? gameRepository.findHistoryByUserBefore(target.getId(), before, pageable)
                : gameRepository.findHistoryByUser(target.getId(), pageable);
        return games.stream().map(GameRepresentation::new).toList();
    }

    public List<GameRepresentation> getPlatformHistory(Long userId, Integer limit, Long before) {
        User user = getUser(userId);

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<Game> games = before != null
                ? gameRepository.findHistoryWithUsersBefore(before, pageable)
                : gameRepository.findHistoryWithUsers(pageable);

        Set<Long> userIds = games.stream().map(Game::getUser).map(User::getId).collect(Collectors.toSet());
        userIds = privacySettingRepository.filterUserIdsByGameHistoryPrivacyParam(PrivacyParam.EVERYONE, userIds);

        List<GameRepresentation> gameRepresentations = new ArrayList<>();
        for (Game game : games) {
            if (userIds.contains(game.getUser().getId())) {
                gameRepresentations.add(new GameRepresentation(game));
            }
            else {
                gameRepresentations.add(null);
            }
        }
        return gameRepresentations;
    }

    public UserGameStatRepresentation getUserStats(Long userId, Long targetId) {
        User user = getUser(userId);
        User target = getUser(targetId);
        PrivacySetting targetPrivacySetting = getPrivacySetting(target.getId());

        privacySettingValidator.validate(user.getId(), target.getId(), targetPrivacySetting.getGameStatsPrivacyParam());

        return new UserGameStatRepresentation(
                gameRepository.countCompletedByUserId(target.getId()),
                gameRepository.maxResultByUserId(target.getId())
        );
    }

    public PlatformGameStatRepresentation getPlatformStats() {
        long since24h = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();
        return new PlatformGameStatRepresentation(
                gameRepository.countCompleted(),
                gameRepository.countCompletedSince(since24h),
                gameRepository.maxResult(),
                gameRepository.maxResultSince(since24h)
        );
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }

    private PrivacySetting getPrivacySetting(Long userId) {
        return privacySettingRepository.findById(userId).orElseThrow(() -> new NotFoundException("privacy setting record not found"));
    }
}
