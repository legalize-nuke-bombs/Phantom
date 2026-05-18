package com.example.phantom.experience;

import lombok.Getter;

@Getter
public class ExperienceRepresentation {
    private final Level level;
    private final Long amount;
    private final Long next;

    public ExperienceRepresentation(Long amount) {
        Level[] levels = Level.values();
        Level level = null;
        Long next = null;

        for (int i = levels.length - 1; i >= 0; i--) {
            if (amount >= levels[i].getAmount()) {
                level = levels[i];
                next = (i + 1 >= levels.length) ? null : levels[i + 1].getAmount();
            }
        }

        this.level = level;
        this.amount = amount;
        this.next = next;
    }
}
