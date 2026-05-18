package com.example.phantom.experience;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.experience.experiencechange.ExperienceChange;
import com.example.phantom.experience.experiencechange.ExperienceChangeRepository;
import com.example.phantom.experience.experiencechange.ExperienceChangeRepresentation;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
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

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Service
public class ExperienceService {

    private final UserRepository userRepository;
    private final PrivacySettingRepository privacySettingRepository;
    private final ExperienceRepository experienceRepository;
    private final ExperienceChangeRepository experienceChangeRepository;
    private final PrivacyParamValidator privacySettingValidator;
    private final UsageLimiter usageLimiter;

    public ExperienceService(UserRepository userRepository, PrivacySettingRepository privacySettingRepository, ExperienceRepository experienceRepository, ExperienceChangeRepository experienceChangeRepository, PrivacyParamValidator privacySettingValidator, UsageLimiter usageLimiter) {
        this.userRepository = userRepository;
        this.privacySettingRepository = privacySettingRepository;
        this.experienceRepository = experienceRepository;
        this.experienceChangeRepository = experienceChangeRepository;
        this.privacySettingValidator = privacySettingValidator;
        this.usageLimiter = usageLimiter;
    }

    public void lock(Long experienceId) {
        experienceRepository.findByIdForPessimisticWrite(experienceId).orElseThrow(() -> new NotFoundException("experience record not found"));
    }

    public void addChange(User user, Long amount, ExperienceChangeType type, String details) {
        if (details == null) details = "";

        ExperienceChange experienceChange = new ExperienceChange();
        experienceChange.setUser(user);
        experienceChange.setAmount(amount);
        experienceChange.setType(type);
        experienceChange.setTimestamp(Instant.now().getEpochSecond());
        experienceChange.setDetails(details);
        experienceChangeRepository.save(experienceChange);
    }

    public Long getAmount(Long userId) {
        return experienceChangeRepository.getAmount(userId);
    }

    public List<LevelRepresentation> getLevels() {
        return Arrays.stream(Level.values()).map(LevelRepresentation::new).toList();
    }

    public ExperienceRepresentation get(Long userId, Long targetId) {
        User user = getUser(userId);
        User target = getUser(targetId);
        PrivacySetting targetPrivacySetting = getPrivacySetting(target.getId());

        privacySettingValidator.validate(user.getId(), target.getId(), targetPrivacySetting.getExperiencePrivacyParam());

        return new ExperienceRepresentation(getAmount(target.getId()));
    }

    public List<ExperienceChangeRepresentation> getHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = getUser(userId);
        User target = getUser(targetId);
        PrivacySetting targetPrivacySetting = getPrivacySetting(target.getId());

        privacySettingValidator.validate(user.getId(), target.getId(), targetPrivacySetting.getExperiencePrivacyParam());

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<ExperienceChange> changes = before != null
                ? experienceChangeRepository.findByUserIdBeforePageable(target.getId(), before, pageable)
                : experienceChangeRepository.findByUserIdPageable(target.getId(), pageable);

        return changes.stream().map(ExperienceChangeRepresentation::new).toList();
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }

    private PrivacySetting getPrivacySetting(Long userId) {
        return privacySettingRepository.findById(userId).orElseThrow(() -> new NotFoundException("privacy setting record not found"));
    }
}
