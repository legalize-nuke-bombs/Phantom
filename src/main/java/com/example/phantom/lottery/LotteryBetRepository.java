package com.example.phantom.lottery;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LotteryBetRepository extends JpaRepository<LotteryBet, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT lb FROM LotteryBet lb WHERE lb.lottery.id = ?1 AND lb.user.id = ?2")
    Optional<LotteryBet> findByLotteryIdAndUserIdForPessimisticWrite(Long lotteryId, Long userId);

    @Query("SELECT COALESCE(SUM(lb.tickets), 0) FROM LotteryBet lb WHERE lb.lottery.id = ?1 AND lb.user.id = ?2")
    Long sumByLotteryIdAndUserId(Long lotteryId, Long userId);

    @Query("SELECT COALESCE(SUM(lb.tickets), 0) FROM LotteryBet lb WHERE lb.lottery.id = ?1")
    Long sumByLotteryId(Long lotteryId);

    @Query("SELECT lb FROM LotteryBet lb WHERE lb.lottery.id = ?1")
    List<LotteryBet> findAllByLotteryId(Long lotteryId);
}
