package com.example.phantom.experience;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.experience.experiencechange.ExperienceChange;
import com.example.phantom.experience.experiencechange.ExperienceChangeRepository;
import com.example.phantom.experience.experiencechange.ExperienceChangeRepresentation;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.PrivacySetting;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Service
public class ExperienceService {

    private final UserRepository userRepository;
    private final ExperienceRepository experienceRepository;
    private final ExperienceChangeRepository experienceChangeRepository;
    private final PrivacySettingValidator privacySettingValidator;
    private final UsageLimiter usageLimiter;

    public ExperienceService(UserRepository userRepository, ExperienceRepository experienceRepository, ExperienceChangeRepository experienceChangeRepository, PrivacySettingValidator privacySettingValidator, UsageLimiter usageLimiter) {
        this.userRepository = userRepository;
        this.experienceRepository = experienceRepository;
        this.experienceChangeRepository = experienceChangeRepository;
        this.privacySettingValidator = privacySettingValidator;
        this.usageLimiter = usageLimiter;
    }

    public Experience lock(Long experienceId) {
        return experienceRepository.findByIdForPessimisticWrite(experienceId).orElseThrow(() -> new NotFoundException("experience record not found"));
    }

    public Experience getExperience(Long experienceId) {
        return experienceRepository.findById(experienceId).orElseThrow(() -> new NotFoundException("experience record not found"));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ExperienceChange addChange(User user, Experience experience, Long amount, ExperienceChangeType type, String details) {
        if (details == null) details = "";

        experience.setAmountCached(experience.getAmountCached() + amount);
        experienceRepository.save(experience);

        ExperienceChange experienceChange = new ExperienceChange();
        experienceChange.setUser(user);
        experienceChange.setAmount(amount);
        experienceChange.setType(type);
        experienceChange.setTimestamp(Instant.now().getEpochSecond());
        experienceChange.setDetails(details);
        return experienceChangeRepository.save(experienceChange);
    }

    public List<LevelRepresentation> getLevels() {
        return Arrays.stream(Level.values()).map(LevelRepresentation::new).toList();
    }

    public ExperienceRepresentation get(Long userId, Long targetId) {
        User user = getUser(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getExperiencePrivacySetting());

        Experience experience = getExperience(target.getId());
        return new ExperienceRepresentation(experience);
    }

    public List<ExperienceChangeRepresentation> getHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = getUser(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getExperiencePrivacySetting());

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<ExperienceChange> changes = before != null
                ? experienceChangeRepository.findByUserIdBeforePageable(target.getId(), before, pageable)
                : experienceChangeRepository.findByUserIdPageable(target.getId(), pageable);

        return changes.stream().map(ExperienceChangeRepresentation::new).toList();
    }

    public List<ProfileCardRepresentation> getLeaderboard(Long userId, Integer limit, Long beforeAmount, Long beforeUserId) {
        User user = getUser(userId);

        if ((beforeAmount == null) != (beforeUserId == null)) {
            throw new BadRequestException("beforeAmount and beforeUserId must be both set or both empty");
        }

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<Experience> experiences = beforeAmount != null
                ? experienceRepository.findLeaderboardWithUsersBefore(PrivacySetting.EVERYONE, beforeAmount, beforeUserId, pageable)
                : experienceRepository.findLeaderboardWithUsers(PrivacySetting.EVERYONE, pageable);

        return experiences.stream().map(e -> new ProfileCardRepresentation(e.getUser(), e)).toList();
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }
}
