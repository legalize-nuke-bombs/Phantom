package com.example.phantom.game.thecase;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface CaseGameLogRepository extends JpaRepository<CaseGameLog, Long> {
    @Query("SELECT l FROM CaseGameLog l WHERE l.user.id = ?1 ORDER BY l.id DESC")
    List<CaseGameLog> findByUserIdPageable(Long userId, Pageable pageable);

    @Query("SELECT l FROM CaseGameLog l WHERE l.user.id = ?1 AND l.id < ?2 ORDER BY l.id DESC")
    List<CaseGameLog> findByUserIdBeforePageable(Long userId, Long before, Pageable pageable);
}
