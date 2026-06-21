package com.example.phantom.game;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.PrivacySettingService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GameHistoryService {

    private final UserRepository userRepository;
    private final GameRepository gameRepository;
    private final RateLimitService rateLimitService;
    private final PrivacySettingService privacySettingService;

    public GameHistoryService(UserRepository userRepository, GameRepository gameRepository, RateLimitService rateLimitService, PrivacySettingService privacySettingService) {
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

        return games.stream().map(GameRepresentation::new).toList();
    }

    public List<GameRepresentation> getPlatformHistory(Long userId, Integer limit, Long before) {
        User user = requireAuthenticated(userId);

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Game> games = gameRepository.findHistoryWithUsersUsingPrivacyPolicy(user.getId(), before, pageable);

        return games.stream().map(GameRepresentation::new).toList();
    }

    private User requireAuthenticated(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }
}
