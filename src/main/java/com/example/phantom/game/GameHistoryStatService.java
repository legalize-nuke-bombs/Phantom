package com.example.phantom.game;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
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
    private final ProfileService profileService;
    private final UsageLimitService usageLimitService;
    private final PrivacySettingValidator privacySettingValidator;

    public GameHistoryStatService(UserRepository userRepository, GameRepository gameRepository, ProfileService profileService, UsageLimitService usageLimitService, PrivacySettingValidator privacySettingValidator) {
        this.userRepository = userRepository;
        this.gameRepository = gameRepository;
        this.profileService = profileService;
        this.usageLimitService = usageLimitService;
        this.privacySettingValidator = privacySettingValidator;
    }

    public List<GameRepresentation> getUserHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getGameHistoryPrivacySetting());

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Game> games = gameRepository.findHistoryByUser(target.getId(), before, pageable);

        ProfileCardRepresentation targetCard = profileService.getCardForUser(userId, target);

        return games.stream().map(game -> new GameRepresentation(game, targetCard)).toList();
    }

    public List<GameRepresentation> getPlatformHistory(Long userId, Integer limit, Long before) {
        User user = requireAuthenticated(userId);

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Game> games = gameRepository.findHistoryWithUsersUsingPrivacyPolicy(user.getId(), before, pageable);

        List<User> users = games.stream().map(Game::getUser).toList();
        Map<Long, ProfileCardRepresentation> cardsByUserId = profileService.getCardsForUsers(userId, users);

        List<GameRepresentation> gameRepresentations = new ArrayList<>();
        for (Game game : games) {
            gameRepresentations.add(new GameRepresentation(
                    game,
                    cardsByUserId.get(game.getUser().getId())
            ));
        }
        return gameRepresentations;
    }

    public UserGameStatRepresentation getUserStats(Long userId, Long targetId) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getGameStatsPrivacySetting());

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
