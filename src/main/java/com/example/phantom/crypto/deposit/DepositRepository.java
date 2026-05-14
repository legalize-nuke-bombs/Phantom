package com.example.phantom.crypto.deposit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface DepositRepository extends JpaRepository<Deposit, Long> {
    @Query("SELECT d.txHash FROM Deposit d WHERE d.txHash IN ?1")
    List<String> findExistingHashes(List<String> hashes);
}
