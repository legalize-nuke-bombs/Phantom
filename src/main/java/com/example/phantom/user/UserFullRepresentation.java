package com.example.phantom.user;

import lombok.Getter;

@Getter
public class UserFullRepresentation {
    private final Long id;
    private final String username;
    private final String displayName;
    private final Long registeredAt;
    private final Role role;
    private final Plan plan;
    private final PrivacySetting gameHistoryPrivacySetting;
    private final PrivacySetting gameStatsPrivacySetting;
    private final PrivacySetting experiencePrivacySetting;
    private final PrivacySetting lotteryPrivacySetting;

    public UserFullRepresentation(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.displayName = user.getDisplayName();
        this.registeredAt = user.getRegisteredAt();
        this.role = user.getRole();
        this.plan = user.getPlan();
        this.gameHistoryPrivacySetting = user.getGameHistoryPrivacySetting();
        this.gameStatsPrivacySetting = user.getGameStatsPrivacySetting();
        this.experiencePrivacySetting = user.getExperiencePrivacySetting();
        this.lotteryPrivacySetting = user.getLotteryPrivacySetting();
    }
}
