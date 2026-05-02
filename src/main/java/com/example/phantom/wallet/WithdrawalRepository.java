package com.example.phantom.wallet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface WithdrawalRepository extends JpaRepository<Withdrawal, String> {
    @Query("SELECT w FROM Withdrawal w WHERE w.user.id = ?1")
    List<Withdrawal> findAllByUserId(Long userId);
}
