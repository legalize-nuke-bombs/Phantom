package com.example.phantom.wallet.balancechange;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;

public interface BalanceChangeRepository extends JpaRepository<BalanceChange, Long> {
    @Query("SELECT COALESCE(SUM(b.amount), 0) FROM BalanceChange b WHERE b.user.id = ?1")
    BigDecimal getBalance(Long userId);

    @Query("SELECT COALESCE(SUM(b.amount), 0) FROM BalanceChange b WHERE b.user.id = ?1 AND b.type = ?2")
    BigDecimal sumByType(Long userId, BalanceChangeType type);

    @Query("SELECT COALESCE(SUM(b.amount), 0) FROM BalanceChange b WHERE b.type = ?1")
    BigDecimal sumByType(BalanceChangeType type);

    @Query("SELECT b FROM BalanceChange b WHERE b.user.id = ?1 ORDER BY b.id DESC")
    List<BalanceChange> findByUserIdPageable(Long userId, Pageable pageable);

    @Query("SELECT b FROM BalanceChange b WHERE b.user.id = ?1 AND b.id < ?2 ORDER BY b.id DESC")
    List<BalanceChange> findByUserIdBeforePageable(Long userId, Long before, Pageable pageable);
}
