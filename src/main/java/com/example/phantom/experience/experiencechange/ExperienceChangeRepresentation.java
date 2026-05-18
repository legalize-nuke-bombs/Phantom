package com.example.phantom.experience.experiencechange;

import lombok.Getter;

@Getter
public class ExperienceChangeRepresentation {
    private final Long id;
    private final Long amount;
    private final ExperienceChangeType type;
    private final Long timestamp;
    private final String details;

    public ExperienceChangeRepresentation(ExperienceChange e) {
        this.id = e.getId();
        this.amount = e.getAmount();
        this.type = e.getType();
        this.timestamp = e.getTimestamp();
        this.details = e.getDetails();
    }
}
