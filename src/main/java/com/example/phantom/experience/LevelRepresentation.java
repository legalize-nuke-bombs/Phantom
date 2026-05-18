package com.example.phantom.experience;

import lombok.Getter;

@Getter
public class LevelRepresentation {
    private final String name;
    private final Long amount;

    public LevelRepresentation(Level level) {
        this.name = level.name();
        this.amount = level.getAmount();
    }
}
