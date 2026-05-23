package com.example.phantom.lottery;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LotteryRepository extends JpaRepository<Lottery, Long> {
    @Query("SELECT l FROM Lottery l WHERE l.ticketsAmountTotal IS NULL ORDER BY l.id DESC LIMIT 1")
    Optional<Lottery> findCurrent();

    @Query("""
SELECT l FROM Lottery l
LEFT JOIN FETCH l.winner
WHERE l.ticketsAmountTotal IS NOT NULL
ORDER BY l.id DESC
""")
    List<Lottery> findFinishedWithWinners(Pageable pageable);

    @Query("""
SELECT l FROM Lottery l
LEFT JOIN FETCH l.winner
WHERE l.ticketsAmountTotal IS NOT NULL AND
l.id < ?1
ORDER BY l.id DESC
""")
    List<Lottery> findFinishedWithWinnersBefore(Long before, Pageable pageable);
}
