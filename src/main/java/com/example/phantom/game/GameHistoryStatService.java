package com.example.phantom.game;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.PrivacySettingService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class GameHistoryStatService {

    private final UserRepository userRepository;
    private final GameRepository gameRepository;
    private final RateLimitService rateLimitService;
    private final PrivacySettingService privacySettingService;

    public GameHistoryStatService(UserRepository userRepository, GameRepository gameRepository, RateLimitService rateLimitService, PrivacySettingService privacySettingService) {
        this.userRepository = userRepository;
        this.gameRepository = gameRepository;
        this.rateLimitService = rateLimitService;
        this.privacySettingService = privacySettingService;
    }

    public List<GameRepresentation> getUserHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingService.validate(user.getId(), target.getId(), target.getGameHistoryPrivacySetting());

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Game> games = gameRepository.findHistoryByUser(target.getId(), before, pageable);

        UserShortRepresentation targetRepresentation = new UserShortRepresentation(target);

        return games.stream().map(game -> new GameRepresentation(game, targetRepresentation)).toList();
    }

    public List<GameRepresentation> getPlatformHistory(Long userId, Integer limit, Long before) {
        User user = requireAuthenticated(userId);

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Game> games = gameRepository.findHistoryWithUsersUsingPrivacyPolicy(user.getId(), before, pageable);

        List<User> users = games.stream().map(Game::getUser).toList();
        Map<Long, UserShortRepresentation> usersById = users.stream().filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toMap(User::getId, UserShortRepresentation::new, (a, b) -> a));

        List<GameRepresentation> gameRepresentations = new ArrayList<>();
        for (Game game : games) {
            gameRepresentations.add(new GameRepresentation(
                    game,
                    usersById.get(game.getUser().getId())
            ));
        }
        return gameRepresentations;
    }

    public UserGameStatRepresentation getUserStats(Long userId, Long targetId) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingService.validate(user.getId(), target.getId(), target.getGameStatsPrivacySetting());

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

    private User requireAuthenticated(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }
}
