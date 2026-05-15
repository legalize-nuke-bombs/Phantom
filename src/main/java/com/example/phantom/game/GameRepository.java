package com.example.phantom.game;

import com.example.phantom.user.PrivacySetting;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface GameRepository extends JpaRepository<Game, Long> {




    @Query("SELECT r FROM Game r WHERE r.user.id = ?1 AND r.gameType = ?2 AND r.clientSeed IS NULL")
    Optional<Game> findActiveRound(Long userId, GameType gameType);

    @Modifying
    @Query("DELETE FROM Game r WHERE r.user.id = ?1 AND r.gameType = ?2 AND r.clientSeed IS NULL")
    void deleteActiveRound(Long userId, GameType gameType);




    @Query("SELECT r FROM Game r WHERE r.user.gameHistoryPrivacySetting = ?1 AND r.clientSeed IS NOT NULL ORDER BY r.id DESC")
    List<Game> findHistoryByUserGameHistoryPrivacySetting(PrivacySetting setting, Pageable pageable);

    @Query("SELECT r FROM Game r WHERE r.user.gameHistoryPrivacySetting = ?1 AND r.clientSeed IS NOT NULL AND r.id < ?2 ORDER BY r.id DESC")
    List<Game> findHistoryByUserGameHistoryPrivacySettingBefore(PrivacySetting setting, Long before, Pageable pageable);

    @Query("SELECT r FROM Game r WHERE r.user.id = ?1 AND r.clientSeed IS NOT NULL ORDER BY r.id DESC")
    List<Game> findHistoryByUser(Long userId, Pageable pageable);

    @Query("SELECT r FROM Game r WHERE r.user.id = ?1 AND r.clientSeed IS NOT NULL AND r.id < ?2 ORDER BY r.id DESC")
    List<Game> findHistoryByUserBefore(Long userId, Long before, Pageable pageable);

    @Query("SELECT r FROM Game r WHERE r.user.id = ?1 AND r.gameType = ?2 AND r.clientSeed IS NOT NULL ORDER BY r.id DESC")
    List<Game> findHistoryByUserAndGameType(Long userId, GameType gameType, Pageable pageable);

    @Query("SELECT r FROM Game r WHERE r.user.id = ?1 AND r.gameType = ?2 AND r.clientSeed IS NOT NULL AND r.id < ?3 ORDER BY r.id DESC")
    List<Game> findHistoryByUserAndGameTypeBefore(Long userId, GameType gameType, Long before, Pageable pageable);




    @Query("SELECT COUNT(r) FROM Game r WHERE r.clientSeed IS NOT NULL")
    long countCompleted();

    @Query("SELECT COUNT(r) FROM Game r WHERE r.clientSeed IS NOT NULL AND r.timestamp >= ?1")
    long countCompletedSince(Long timestamp);

    @Query("SELECT COUNT(r) FROM Game r WHERE r.user.id = ?1 AND r.clientSeed IS NOT NULL")
    long countCompletedByUserId(Long userId);





    @Query("SELECT COUNT(r) FROM Game r WHERE r.user.id = ?1 AND r.gameType = ?2 AND r.clientSeed IS NOT NULL")
    long countCompletedByUserIdAndGameType(Long userId, GameType gameType);

    @Query("SELECT MAX(r.result) FROM Game r WHERE r.clientSeed IS NOT NULL")
    BigDecimal maxResult();

    @Query("SELECT MAX(r.result) FROM Game r WHERE r.clientSeed IS NOT NULL AND r.timestamp >= ?1")
    BigDecimal maxResultSince(Long timestamp);

    @Query("SELECT MAX(r.result) FROM Game r WHERE r.user.id = ?1 AND r.clientSeed IS NOT NULL")
    BigDecimal maxResultByUserId(Long userId);

    @Query("SELECT MAX(r.result) FROM Game r WHERE r.user.id = ?1 AND r.gameType = ?2 AND r.clientSeed IS NOT NULL")
    BigDecimal maxResultByUserIdAndGameType(Long userId, GameType gameType);




}
