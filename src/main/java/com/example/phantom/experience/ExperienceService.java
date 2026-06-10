package com.example.phantom.experience;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.experiencechange.ExperienceChange;
import com.example.phantom.experience.experiencechange.ExperienceChangeRepository;
import com.example.phantom.experience.experiencechange.ExperienceChangeRepresentation;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ExperienceService {

    private final UserRepository userRepository;
    private final ExperienceRepository experienceRepository;
    private final ExperienceChangeRepository experienceChangeRepository;
    private final PrivacySettingValidator privacySettingValidator;
    private final UsageLimitService usageLimitService;
    private final ProfileService profileService;

    public ExperienceService(UserRepository userRepository, ExperienceRepository experienceRepository, ExperienceChangeRepository experienceChangeRepository, PrivacySettingValidator privacySettingValidator, UsageLimitService usageLimitService, ProfileService profileService) {
        this.userRepository = userRepository;
        this.experienceRepository = experienceRepository;
        this.experienceChangeRepository = experienceChangeRepository;
        this.privacySettingValidator = privacySettingValidator;
        this.usageLimitService = usageLimitService;
        this.profileService = profileService;
    }

    public Experience lock(Long experienceId) {
        return experienceRepository.findByIdForPessimisticWrite(experienceId).orElseThrow(() -> new ApiException(ErrorCode.EXPERIENCE_NOT_FOUND));
    }

    public Experience getExperience(Long experienceId) {
        return experienceRepository.findById(experienceId).orElseThrow(() -> new ApiException(ErrorCode.EXPERIENCE_NOT_FOUND));
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

    @Transactional(propagation = Propagation.MANDATORY)
    public void addChanges(List<ExperienceChange> changes) {
        Map<Long, Experience> experienceMap = new HashMap<>();
        for (ExperienceChange change : changes) {
            Long userId = change.getUser().getId();
            if (!experienceMap.containsKey(userId)) {
                experienceMap.put(userId, lock(userId));
            }
            experienceMap.get(userId).setAmountCached(experienceMap.get(userId).getAmountCached() + change.getAmount());
        }
        experienceRepository.saveAll(experienceMap.values());

        experienceChangeRepository.saveAll(changes);
    }

    public List<LevelRepresentation> getLevels() {
        return Arrays.stream(Level.values()).map(LevelRepresentation::new).toList();
    }

    public ExperienceRepresentation get(Long userId, Long targetId) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getExperiencePrivacySetting());

        Experience experience = getExperience(target.getId());
        return new ExperienceRepresentation(experience);
    }

    public List<ExperienceChangeRepresentation> getHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = requireAuthenticated(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getExperiencePrivacySetting());

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<ExperienceChange> changes = experienceChangeRepository.findByUserIdPageable(target.getId(), before, pageable);

        return changes.stream().map(ExperienceChangeRepresentation::new).toList();
    }

    public List<ProfileCardRepresentation> getLeaderboard(Long userId, Integer limit, Long beforeAmount, Long beforeUserId) {
        User user = requireAuthenticated(userId);

        if ((beforeAmount == null) != (beforeUserId == null)) {
            throw new ApiException(ErrorCode.INVALID_CURSOR);
        }

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<User> users = experienceRepository.findBestUsersUsingPrivacyPolicy(user.getId(), beforeAmount, beforeUserId, pageable);

        Map<Long, ProfileCardRepresentation> cardsByUserId = profileService.getCardsForUsers(userId, users);
        return users.stream().map(u -> cardsByUserId.get(u.getId())).toList();
    }

    private User requireAuthenticated(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }
}
