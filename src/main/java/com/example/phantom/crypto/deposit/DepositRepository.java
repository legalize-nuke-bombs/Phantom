package com.example.phantom.crypto.deposit;

import com.example.phantom.crypto.CoinType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface DepositRepository extends JpaRepository<Deposit, Long> {
    @Query("SELECT d.txHash FROM Deposit d WHERE d.txHash IN ?1")
    List<String> findExistingHashes(List<String> hashes);

    @Query("SELECT d FROM Deposit d JOIN FETCH d.user WHERE d.user.id = ?1 AND d.coin = ?2 AND (?3 IS NULL OR d.id < ?3) ORDER BY d.id DESC")
    List<Deposit> findByUserIdAndCoinWithUsers(Long userId, CoinType coin, Long before, Pageable pageable);
}
