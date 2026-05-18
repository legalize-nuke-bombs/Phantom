package com.example.phantom.experience;

import lombok.Getter;

@Getter
public enum Level {
    Whisper(0L),
    Echo(500L),
    Shade(1000L),
    Wisp(2500L),
    Spectre(5000L),
    Phantom(10000L),
    Revenant(25000L),
    Reaper(50000L)
    ;

    private final Long amount;

    Level(Long amount) {
        this.amount = amount;
    }

}
