package com.example.phantom.experience;

import lombok.Getter;

import java.util.Set;

@Getter
public enum Level {
    Whisper(0L),
    Echo(2500L, Set.of(LevelFeature.SEND_MESSAGE, LevelFeature.SEND_PRESENT, LevelFeature.DISK_BASE)),
    Shade(5000L),
    Wisp(10000L),
    Spectre(25000L),
    Phantom(50000L, Set.of(LevelFeature.DISK_PLUS)),
    Revenant(100000L),
    Reaper(200000L)
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
