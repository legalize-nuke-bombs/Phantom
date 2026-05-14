package com.example.phantom.crypto.withdrawal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RefundRepository extends JpaRepository<Refund, Long> {
    @Modifying
    @Query(value = "INSERT INTO refunds (withdrawal_id) VALUES (?1) ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertIfNotExists(Long withdrawalId);
}
