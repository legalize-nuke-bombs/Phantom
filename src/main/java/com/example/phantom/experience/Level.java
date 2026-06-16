package com.example.phantom.experience;

import lombok.Getter;

import java.util.Set;

@Getter
public enum Level {
    Whisper(0L),
    Echo(500L, Set.of(LevelFeature.SEND_MESSAGE, LevelFeature.SEND_PRESENT, LevelFeature.DISK_BASE)),
    Shade(2500L),
    Wisp(5000L, Set.of(LevelFeature.DISK_PLUS)),
    Spectre(10000L),
    Phantom(25000L, Set.of(LevelFeature.DISK_PRO)),
    Revenant(50000L),
    Reaper(100000L)
    ;

    private final Long amount;
    private final Set<LevelFeature> features;

    Level(Long amount, Set<LevelFeature> features) {
        this.amount = amount;
        this.features = features;
    }

    Level(Long amount) {
        this.amount = amount;
        this.features = Set.of();
    }
}
