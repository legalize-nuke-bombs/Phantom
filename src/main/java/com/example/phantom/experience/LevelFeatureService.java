package com.example.phantom.experience;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

@Service
public class LevelFeatureService {

    private final ExperienceRepository experienceRepository;
    private final Map<Level, Set<LevelFeature>> levelFeatureMap;

    public LevelFeatureService(ExperienceRepository experienceRepository) {
        this.experienceRepository = experienceRepository;

        this.levelFeatureMap = new EnumMap<>(Level.class);
        for (Level level : Level.values()) {
            this.levelFeatureMap.put(level, Set.of());
        }
        for (var entry : levelFeatureMap.keySet()) {
            for (Level level : Level.values()) {
                if (entry.getAmount() >= level.getAmount()) {
                    for (LevelFeature feature : level.getFeatures()) {
                        this.levelFeatureMap.get(entry).add(feature);
                    }
                }
            }
        }
    }

    public void validateAccess(Long userId, LevelFeature feature) {
        if (!haveAccess(userId, feature)) {
            throw new ApiException(ErrorCode.EXPERIENCE_NOT_FOUND);
        }
    }

    public boolean haveAccess(Long userId, LevelFeature feature) {
        Experience experience = experienceRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.EXPERIENCE_NOT_FOUND));

        ExperienceRepresentation representation = new ExperienceRepresentation(experience);
        Level level = representation.getLevel();

        Set<LevelFeature> features = levelFeatureMap.get(level);

        return features.contains(feature);
    }
}
