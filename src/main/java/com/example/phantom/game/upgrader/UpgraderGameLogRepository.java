package com.example.phantom.game.upgrader;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface UpgraderGameLogRepository extends JpaRepository<UpgraderGameLog, Long> {
    @Query("SELECT l FROM UpgraderGameLog l WHERE l.user.id = ?1 ORDER BY l.id DESC")
    List<UpgraderGameLog> findByUserIdPageable(Long userId, Pageable pageable);

    @Query("SELECT l FROM UpgraderGameLog l WHERE l.user.id = ?1 AND l.id < ?2 ORDER BY l.id DESC")
    List<UpgraderGameLog> findByUserIdBeforePageable(Long userId, Long before, Pageable pageable);
}
