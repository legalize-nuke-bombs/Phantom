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
                g.clientSeed IS NOT NULL AND
                (?2 IS NULL OR g.id < ?2)
                ORDER BY g.id DESC
""")
    List<Game> findHistoryWithUsersUsingPrivacyPolicy(Long viewerId, Long before, Pageable pageable);

    @Query("SELECT g FROM Game g WHERE g.user.id = ?1 AND g.clientSeed IS NOT NULL AND (?2 IS NULL OR g.id < ?2) ORDER BY g.id DESC")
    List<Game> findHistoryByUser(Long userId, Long before, Pageable pageable);

    @Query("""
SELECT COUNT(g), MAX(g.result)
FROM Game g
WHERE
g.clientSeed IS NOT NULL AND
(?1 IS NULL OR g.timestamp >= ?1) AND
(?2 IS NULL OR g.user.id = ?2)
""")
    List<Object[]> findCountAndMaxResult(Long timestamp, Long userId);

    @Query("""
SELECT g.gameType, COUNT(g), SUM(g.bet), SUM(g.result)
FROM Game g
WHERE
(?1 IS NULL OR g.timestamp >= ?1) AND
(?2 IS NULL OR g.timestamp < ?2)
GROUP BY g.gameType
""")
    List<Object[]> findGroupedByGameTypeCountAndBetsAndResults(Long since, Long before);
}
