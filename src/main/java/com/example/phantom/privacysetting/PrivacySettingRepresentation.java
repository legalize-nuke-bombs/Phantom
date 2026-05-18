package com.example.phantom.privacysetting;

import lombok.Getter;

@Getter
public class PrivacySettingRepresentation {
    private final PrivacyParam walletBalancePrivacyParam;
    private final PrivacyParam walletHistoryPrivacyParam;
    private final PrivacyParam walletStatsPrivacyParam;
    private final PrivacyParam gameHistoryPrivacyParam;
    private final PrivacyParam gameStatsPrivacyParam;
    private final PrivacyParam experiencePrivacyParam;

    public PrivacySettingRepresentation(PrivacySetting privacySetting) {
        this.walletBalancePrivacyParam = privacySetting.getWalletBalancePrivacyParam();
        this.walletHistoryPrivacyParam = privacySetting.getWalletHistoryPrivacyParam();
        this.walletStatsPrivacyParam = privacySetting.getWalletStatsPrivacyParam();
        this.gameHistoryPrivacyParam = privacySetting.getGameHistoryPrivacyParam();
        this.gameStatsPrivacyParam = privacySetting.getGameStatsPrivacyParam();
        this.experiencePrivacyParam = privacySetting.getExperiencePrivacyParam();
    }
}
