package com.example.phantom.privacysetting;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Set;

public interface PrivacySettingRepository extends JpaRepository<PrivacySetting, Long> {
    @Query("SELECT s.user.id FROM PrivacySetting s WHERE s.gameHistoryPrivacyParam = ?1 AND s.id IN ?2")
    Set<Long> filterUserIdsByGameHistoryPrivacyParam(PrivacyParam privacyParam, Set<Long> userIds);
}
