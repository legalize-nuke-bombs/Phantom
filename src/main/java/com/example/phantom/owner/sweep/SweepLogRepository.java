package com.example.phantom.owner.sweep;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SweepLogRepository extends JpaRepository<SweepLog, Long> {
    @Query("SELECT l FROM SweepLog l ORDER BY l.id DESC")
    List<SweepLog> findAllPageable(Pageable pageable);

    @Query("SELECT l FROM SweepLog l WHERE l.id < ?1 ORDER BY l.id DESC")
    List<SweepLog> findAllBeforePageable(Long before, Pageable pageable);
}
