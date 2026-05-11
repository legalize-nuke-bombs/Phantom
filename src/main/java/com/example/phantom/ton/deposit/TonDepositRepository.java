package com.example.phantom.ton.deposit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TonDepositRepository extends JpaRepository<TonDeposit, Long> {
    @Query("SELECT d.txHash FROM TonDeposit d WHERE d.txHash IN ?1")
    List<String> findExistingHashes(List<String> hashes);
}
