package com.example.phantom.experience;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.experiencechange.ExperienceChange;
import com.example.phantom.experience.experiencechange.ExperienceChangeRepository;
import com.example.phantom.experience.experiencechange.ExperienceChangeRepresentation;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.PrivacySettingService;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ExperienceService {

    private final UserRepository userRepository;
    private final ExperienceRepository experienceRepository;
    private final ExperienceChangeRepository experienceChangeRepository;
    private final PrivacySettingService privacySettingService;
    private final RateLimitService rateLimitService;

    public ExperienceService(UserRepository userRepository, ExperienceRepository experienceRepository, ExperienceChangeRepository experienceChangeRepository, PrivacySettingService privacySettingService, RateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.experienceRepository = experienceRepository;
        this.experienceChangeRepository = experienceChangeRepository;
        this.privacySettingService = privacySettingService;
        this.rateLimitService = rateLimitService;
    }

    public Experience lock(Long experienceId) {
        return experienceRepository.findByIdForPessimisticWrite(experienceId).orElseThrow(() -> new ApiException(ErrorCode.EXPERIENCE_NOT_FOUND));
    }

    public Experience getExperience(Long experienceId) {
        return experienceRepository.findById(experienceId).orElseThrow(() -> new ApiException(ErrorCode.EXPERIENCE_NOT_FOUND));
    }

    @Transactional
    public void addChange(User user, Long amount, ExperienceChangeType type, String details) {
        if (details == null) details = "";

        Experience experience = lock(user.getId());
        experience.setAmountCached(experience.getAmountCached() + amount);
        experienceRepository.save(experience);

        ExperienceChange experienceChange = new ExperienceChange();
        experienceChange.setUser(user);
        experienceChange.setAmount(amount);
        experienceChange.setType(type);
        experienceChange.setTimestamp(Instant.now().getEpochSecond());
        experienceChange.setDetails(details);
        experienceChangeRepository.save(experienceChange);
    }

    public ExperienceRepresentation get(Long userId, Long targetId) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingService.validate(user.getId(), target.getId(), target.getExperiencePrivacySetting());

        Experience experience = getExperience(target.getId());
        return new ExperienceRepresentation(experience);
    }

    public List<ExperienceChangeRepresentation> getHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingService.validate(user.getId(), target.getId(), target.getExperiencePrivacySetting());

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<ExperienceChange> changes = experienceChangeRepository.findByUserIdPageable(target.getId(), before, pageable);

        return changes.stream().map(ExperienceChangeRepresentation::new).toList();
    }

    public List<LeaderboardEntryRepresentation> getLeaderboard(Long userId, Integer limit, Long beforeAmount, Long beforeUserId) {
        User user = requireAuthenticated(userId);

        if ((beforeAmount == null) != (beforeUserId == null)) {
            throw new ApiException(ErrorCode.INVALID_CURSOR);
        }

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<User> users = experienceRepository.findBestUsersUsingPrivacyPolicy(user.getId(), beforeAmount, beforeUserId, pageable);

        Set<Long> visibleIds = users.stream()
                .filter(Objects::nonNull)
                .filter(u -> privacySettingService.isVisible(user.getId(), u.getId(), u.getExperiencePrivacySetting()))
                .map(User::getId)
                .collect(Collectors.toSet());

        Map<Long, Experience> experiences = experienceRepository.findAllById(visibleIds).stream().collect(Collectors.toMap(Experience::getId, Function.identity()));

        return users.stream()
                .filter(Objects::nonNull)
                .map(u -> {
                    Experience experience = experiences.get(u.getId());
                    return new LeaderboardEntryRepresentation(new UserShortRepresentation(u), experience != null ? new ExperienceRepresentation(experience) : null);
                })
                .toList();
    }

    private User requireAuthenticated(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }
}
