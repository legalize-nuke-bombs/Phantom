package com.example.phantom.experience;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

@Getter
public class LeaderboardEntryRepresentation {
    private final UserShortRepresentation user;
    private final ExperienceRepresentation experience;

    public LeaderboardEntryRepresentation(UserShortRepresentation user, ExperienceRepresentation experience) {
        this.user = user;
        this.experience = experience;
    }
}
