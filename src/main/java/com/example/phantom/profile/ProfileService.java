package com.example.phantom.profile;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.experience.Experience;
import com.example.phantom.experience.ExperienceRepository;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.User;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ProfileService {

    private final ExperienceRepository experienceRepository;
    private final PrivacySettingValidator privacySettingValidator;

    public ProfileService(ExperienceRepository experienceRepository, PrivacySettingValidator privacySettingValidator) {
        this.experienceRepository = experienceRepository;
        this.privacySettingValidator = privacySettingValidator;
    }

    public ProfileCardRepresentation getCardForUser(Long viewerId, User user) {
        if (user == null) {
            return null;
        }

        Experience experience = privacySettingValidator.isVisible(viewerId, user.getId(), user.getExperiencePrivacySetting())
                ? experienceRepository.findById(user.getId()).orElseThrow(() -> new NotFoundException("experience record not found"))
                : null;
        return new ProfileCardRepresentation(user, experience);
    }

    public Map<Long, ProfileCardRepresentation> getCardsForUsers(Long viewerId, Collection<User> users) {
        if (users.isEmpty()) return Map.of();

        Set<Long> visibleIds = users.stream()
                .filter(Objects::nonNull)
                .filter(u -> privacySettingValidator.isVisible(viewerId, u.getId(), u.getExperiencePrivacySetting()))
                .map(User::getId)
                .collect(Collectors.toSet());

        Map<Long, Experience> experiences = experienceRepository.findAllById(visibleIds).stream().collect(Collectors.toMap(Experience::getId, Function.identity()));

        return users.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(User::getId, u -> new ProfileCardRepresentation(u, experiences.get(u.getId())), (a, b) -> a));
    }
}
