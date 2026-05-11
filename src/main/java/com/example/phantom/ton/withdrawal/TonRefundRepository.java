package com.example.phantom.ton.withdrawal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TonRefundRepository extends JpaRepository<TonRefund, Long> {
    @Modifying
    @Query(value = "INSERT INTO ton_refunds (ton_withdrawal_id) VALUES (?1) ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertIfNotExists(Long tonWithdrawalId);
}
