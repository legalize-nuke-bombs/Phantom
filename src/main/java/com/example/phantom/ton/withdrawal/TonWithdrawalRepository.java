package com.example.phantom.ton.withdrawal;

import com.example.phantom.ton.TonTransferStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TonWithdrawalRepository extends JpaRepository<TonWithdrawal, Long> {
    @Query("SELECT tw FROM TonWithdrawal tw WHERE tw.user.id = ?1 AND tw.status = ?2")
    List<TonWithdrawal> findByUserIdAndStatus(Long userId, TonTransferStatus status);
}
