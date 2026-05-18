package com.example.phantom.privacysetting;

import com.example.phantom.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class PrivacySettingService {

    private final PrivacySettingRepository privacySettingRepository;

    public PrivacySettingService(PrivacySettingRepository privacySettingRepository) {
        this.privacySettingRepository = privacySettingRepository;
    }

    public PrivacySettingRepresentation get(Long targetId) {
        PrivacySetting privacySetting = getPrivacySetting(targetId);
        return new PrivacySettingRepresentation(privacySetting);
    }

    public Map<String, String> patchMe(Long userId, PatchMyPrivacySettingsRequest request) {
        PrivacySetting privacySetting = getPrivacySetting(userId);

        PrivacyParam walletBalancePrivacySetting = request.getWalletBalancePrivacyParam();
        PrivacyParam walletHistoryPrivacySetting = request.getWalletHistoryPrivacyParam();
        PrivacyParam walletStatsPrivacySetting = request.getWalletStatsPrivacyParam();
        PrivacyParam gameHistoryPrivacySetting = request.getGameHistoryPrivacyParam();
        PrivacyParam gameStatsPrivacySetting = request.getGameStatsPrivacyParam();
        PrivacyParam experiencePrivacySetting = request.getExperiencePrivacyParam();

        if (walletBalancePrivacySetting != null) privacySetting.setWalletBalancePrivacyParam(walletBalancePrivacySetting);
        if (walletHistoryPrivacySetting != null) privacySetting.setWalletHistoryPrivacyParam(walletHistoryPrivacySetting);
        if (walletStatsPrivacySetting != null) privacySetting.setWalletStatsPrivacyParam(walletStatsPrivacySetting);
        if (gameHistoryPrivacySetting != null) privacySetting.setGameHistoryPrivacyParam(gameHistoryPrivacySetting);
        if (gameStatsPrivacySetting != null) privacySetting.setGameStatsPrivacyParam(gameStatsPrivacySetting);
        if (experiencePrivacySetting != null) privacySetting.setExperiencePrivacyParam(experiencePrivacySetting);

        privacySettingRepository.save(privacySetting);

        return Map.of("message", "patched");
    }

    private PrivacySetting getPrivacySetting(Long userId) {
        return privacySettingRepository.findById(userId).orElseThrow(() -> new NotFoundException("privacy setting not found"));
    }
}
