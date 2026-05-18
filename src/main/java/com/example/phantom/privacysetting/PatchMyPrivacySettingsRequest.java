package com.example.phantom.privacysetting;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PatchMyPrivacySettingsRequest {
    private PrivacyParam walletBalancePrivacyParam;
    private PrivacyParam walletHistoryPrivacyParam;
    private PrivacyParam walletStatsPrivacyParam;
    private PrivacyParam gameHistoryPrivacyParam;
    private PrivacyParam gameStatsPrivacyParam;
    private PrivacyParam experiencePrivacyParam;
}
