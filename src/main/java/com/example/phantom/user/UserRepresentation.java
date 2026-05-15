package com.example.phantom.user;

import lombok.Getter;

@Getter
public class UserRepresentation {
    private final Long id;
    private final String username;
    private final String displayName;
    private final Long registeredAt;
    private final Role role;
    private final Plan plan;
    private final PrivacySetting walletBalancePrivacySetting;
    private final PrivacySetting walletHistoryPrivacySetting;
    private final PrivacySetting walletStatsPrivacySetting;
    private final PrivacySetting gameHistoryPrivacySetting;
    private final PrivacySetting gameStatsPrivacySetting;

    public UserRepresentation(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.displayName = user.getDisplayName();
        this.registeredAt = user.getRegisteredAt();
        this.role = user.getRole();
        this.plan = user.getPlan();
        this.walletBalancePrivacySetting = user.getWalletBalancePrivacySetting();
        this.walletHistoryPrivacySetting = user.getWalletHistoryPrivacySetting();
        this.walletStatsPrivacySetting = user.getWalletStatsPrivacySetting();
        this.gameHistoryPrivacySetting = user.getGameHistoryPrivacySetting();
        this.gameStatsPrivacySetting = user.getGameStatsPrivacySetting();
    }
}
