package com.example.phantom.experience;

import lombok.Getter;

import java.util.Set;

@Getter
public class LevelRepresentation {
    private final String name;
    private final Long amount;
    private final Set<LevelFeature> features;

    public LevelRepresentation(Level level) {
        this.name = level.name();
        this.amount = level.getAmount();
        this.features = level.getFeatures();
    }
}
