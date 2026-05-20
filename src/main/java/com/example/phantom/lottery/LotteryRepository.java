package com.example.phantom.lottery;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LotteryRepository extends JpaRepository<Lottery, Long> {
    @Query("SELECT MAX(l.id) FROM Lottery l")
    Optional<Long> findLastId();

    @Query("SELECT l FROM Lottery l JOIN FETCH l.winner WHERE l.ticketsAmountTotal IS NOT NULL AND l.id < ?1 ORDER BY l.id DESC")
    List<Lottery> findFinishedWithWinnersBefore(Long before, Pageable pageable);

    @Query("SELECT l FROM Lottery l JOIN FETCH l.winner WHERE l.ticketsAmountTotal IS NOT NULL ORDER BY l.id DESC")
    List<Lottery> findFinishedWithWinners(Pageable pageable);
}
