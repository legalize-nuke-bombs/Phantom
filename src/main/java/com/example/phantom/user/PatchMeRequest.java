package com.example.phantom.user;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PatchMeRequest {
    @Size(min= UserConstants.DISPLAY_NAME_MIN_LENGTH, max= UserConstants.DISPLAY_NAME_MAX_LENGTH)
    private String displayName;

    private PrivacySetting walletBalancePrivacySetting;
    private PrivacySetting walletHistoryPrivacySetting;
    private PrivacySetting walletStatsPrivacySetting;
    private PrivacySetting gameHistoryPrivacySetting;
    private PrivacySetting gameStatsPrivacySetting;
}
