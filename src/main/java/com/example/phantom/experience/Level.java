package com.example.phantom.experience;

import lombok.Getter;

@Getter
public enum Level {
    Whisper(0L),
    Echo(500L),
    Shade(2500L),
    Wisp(5000L),
    Spectre(10000L),
    Phantom(25000L),
    Revenant(50000L),
    Reaper(100000L)
    ;

    private final Long amount;

    Level(Long amount) {
        this.amount = amount;
    }

}
