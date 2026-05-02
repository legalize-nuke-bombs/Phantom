package com.example.phantom.wallet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.math.BigDecimal;

public interface TransactionRepository extends JpaRepository<Transaction, String> {
    @Modifying
    @Query(value = "INSERT INTO transactions (id, value) VALUES (?1, ?2) ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertIfNotExists(String id, BigDecimal value);
}