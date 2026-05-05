package com.example.phantom.wallet.ton;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface TonWalletRepository extends JpaRepository<TonWallet, Long> {
    @Query("SELECT tw from TonWallet tw WHERE tw.user.id = ?1")
    Optional<TonWallet> findByUserId(Long userId);
}
