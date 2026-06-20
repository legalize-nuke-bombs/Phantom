package com.example.phantom.crypto.withdrawal;

import com.example.phantom.crypto.CoinType;
import com.example.phantom.crypto.TransferStatus;
import lombok.With;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface WithdrawalRepository extends JpaRepository<Withdrawal, Long> {
    @Query("SELECT w FROM Withdrawal w WHERE w.user.id = ?1 AND w.coin = ?2 AND w.status = ?3")
    List<Withdrawal> findByUserIdAndCoinAndStatus(Long userId, CoinType coin, TransferStatus status);

    @Query("SELECT w FROM Withdrawal w JOIN FETCH w.user WHERE w.user.id = ?1 AND w.coin = ?2 AND (?3 IS NULL OR w.id < ?3) ORDER BY w.id DESC")
    List<Withdrawal> findByUserIdAndCoinWithUsers(Long userId, CoinType coin, Long before, Pageable pageable);

    @Query("SELECT w FROM Withdrawal w JOIN FETCH w.user WHERE (?1 IS NULL OR w.id < ?1) ORDER BY w.id DESC")
    List<Withdrawal> findHistoryWithUsers(Long before, Pageable pageable);
}
