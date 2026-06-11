package com.example.phantom.lottery;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LotteryBetRepository extends JpaRepository<LotteryBet, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT lb FROM LotteryBet lb WHERE lb.lottery.id = ?1 AND (lb.user IS NOT NULL AND lb.user.id = ?2)")
    Optional<LotteryBet> findByLotteryIdAndUserIdForPessimisticWrite(Long lotteryId, Long userId);

    @Query("SELECT COALESCE(SUM(lb.tickets), 0) FROM LotteryBet lb WHERE lb.lottery.id = ?1 AND (lb.user IS NOT NULL AND lb.user.id = ?2)")
    Long sumByLotteryIdAndUserId(Long lotteryId, Long userId);

    @Query("SELECT COALESCE(SUM(lb.tickets), 0) FROM LotteryBet lb WHERE lb.lottery.id = ?1")
    Long sumByLotteryId(Long lotteryId);

    @Query("SELECT lb FROM LotteryBet lb LEFT JOIN FETCH lb.user WHERE lb.lottery.id = ?1 AND lb.tickets != 0 ORDER BY lb.tickets DESC, lb.id DESC")
    List<LotteryBet> findAllByLotteryIdWithUsers(Long lotteryId);

    @Query("""
            SELECT lb FROM LotteryBet lb
            LEFT JOIN FETCH lb.user
            WHERE lb.lottery.id = ?1 AND lb.tickets != 0 AND
            (?2 IS NULL OR lb.tickets < ?2 OR (lb.tickets = ?2 AND lb.id < ?3))
            ORDER BY lb.tickets DESC, lb.id DESC
""")
    List<LotteryBet> findAllByLotteryIdWithUsers(Long lotteryId, Long beforeTickets, Long beforeId, Pageable pageable);
}
