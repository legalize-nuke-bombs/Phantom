package com.example.phantom.game;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface GameRepository extends JpaRepository<Game, Long> {




    @Query("SELECT g FROM Game g WHERE g.user.id = ?1 AND g.gameType = ?2 AND g.clientSeed IS NULL")
    Optional<Game> findActiveGame(Long userId, GameType gameType);

    @Modifying
    @Query("DELETE FROM Game g WHERE g.user.id = ?1 AND g.gameType = ?2 AND g.clientSeed IS NULL")
    void deleteActiveGame(Long userId, GameType gameType);




    @Query("""
                SELECT g FROM Game g
                JOIN FETCH g.user
                WHERE (g.user.id = ?1 OR g.user.gameHistoryPrivacySetting = com.example.phantom.user.PrivacySetting.EVERYONE) AND
                g.clientSeed IS NOT NULL
                ORDER BY g.id DESC
""")
    List<Game> findHistoryWithUsersUsingPrivacyPolicy(Long viewerId, Pageable pageable);

    @Query("""
                SELECT g FROM Game g
                JOIN FETCH g.user
                WHERE (g.user.id = ?1 OR g.user.gameHistoryPrivacySetting = com.example.phantom.user.PrivacySetting.EVERYONE) AND
                g.clientSeed IS NOT NULL AND
                g.id < ?2
                ORDER BY g.id DESC
""")
    List<Game> findHistoryWithUsersUsingPrivacyPolicyBefore(Long viewerId, Long before, Pageable pageable);

    @Query("SELECT g FROM Game g WHERE g.user.id = ?1 AND g.clientSeed IS NOT NULL ORDER BY g.id DESC")
    List<Game> findHistoryByUser(Long userId, Pageable pageable);

    @Query("SELECT g FROM Game g WHERE g.user.id = ?1 AND g.clientSeed IS NOT NULL AND g.id < ?2 ORDER BY g.id DESC")
    List<Game> findHistoryByUserBefore(Long userId, Long before, Pageable pageable);




    @Query("SELECT COUNT(g) FROM Game g WHERE g.clientSeed IS NOT NULL")
    long countCompleted();

    @Query("SELECT COUNT(g) FROM Game g WHERE g.clientSeed IS NOT NULL AND g.timestamp >= ?1")
    long countCompletedSince(Long timestamp);

    @Query("SELECT COUNT(g) FROM Game g WHERE g.user.id = ?1 AND g.clientSeed IS NOT NULL")
    long countCompletedByUserId(Long userId);




    @Query("SELECT MAX(g.result) FROM Game g WHERE g.clientSeed IS NOT NULL")
    BigDecimal maxResult();

    @Query("SELECT MAX(g.result) FROM Game g WHERE g.clientSeed IS NOT NULL AND g.timestamp >= ?1")
    BigDecimal maxResultSince(Long timestamp);

    @Query("SELECT MAX(g.result) FROM Game g WHERE g.user.id = ?1 AND g.clientSeed IS NOT NULL")
    BigDecimal maxResultByUserId(Long userId);

}
