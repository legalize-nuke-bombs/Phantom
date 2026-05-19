package com.example.phantom.experience;

import lombok.Getter;

@Getter
public class ExperienceRepresentation {
    private final Long id;
    private final Level level;
    private final Long amount;
    private final Long next;

    public ExperienceRepresentation(Experience experience) {
        this.id = experience.getId();
        this.amount = experience.getAmountCached();

        Level level = null;
        Long next = null;

        Level[] levels = Level.values();

        for (int i = levels.length - 1; i >= 0; i--) {
            if (this.amount >= levels[i].getAmount()) {
                level = levels[i];
                next = (i + 1 >= levels.length) ? null : levels[i + 1].getAmount();
            }
        }

        this.level = level;
        this.next = next;
    }
}
