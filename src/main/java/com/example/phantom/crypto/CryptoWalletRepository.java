package com.example.phantom.crypto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CryptoWalletRepository extends JpaRepository<CryptoWallet, Long> {
    @Query("SELECT w FROM CryptoWallet w WHERE w.user.id = ?1 AND w.coin = ?2")
    Optional<CryptoWallet> findByUserIdAndCoin(Long userId, String coin);

    @Query("SELECT w FROM CryptoWallet w WHERE w.coin = ?1")
    List<CryptoWallet> findByCoin(String coin);
}
