package com.example.phantom.crypto.withdrawal;

import com.example.phantom.crypto.TransferStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface WithdrawalRepository extends JpaRepository<Withdrawal, Long> {
    @Query("SELECT w FROM Withdrawal w WHERE w.user.id = ?1 AND w.status = ?2")
    List<Withdrawal> findByUserIdAndStatus(Long userId, TransferStatus status);

    @Query("SELECT w FROM Withdrawal w JOIN FETCH w.user WHERE (?1 IS NULL OR w.id < ?1) ORDER BY w.id DESC")
    List<Withdrawal> findHistoryWithUsers(Long before, Pageable pageable);
}
