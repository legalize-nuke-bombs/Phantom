package com.example.phantom.present;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PresentRepository extends JpaRepository<Present, Long> {
    @Query("""
SELECT p
FROM Present p
LEFT JOIN FETCH p.sender
WHERE p.receiver.id = ?1 AND
(?2 IS NULL OR p.claimed = ?2) AND
(?3 IS NULL OR p.id < ?3)
ORDER BY p.id DESC
""")
    List<Present> findByReceiverIdClaimedWithSenders(Long receiverId, Boolean claimed, Long before, Pageable pageable);

    @Query("""
SELECT COUNT(p)
FROM Present p
WHERE p.receiver.id = ?1 AND
(?2 IS NULL OR p.claimed = ?2)
""")
    long countByReceiverIdClaimed(Long receiverId, Boolean claimed);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Present p WHERE p.id = ?1")
    Optional<Present> findByIdForPessimisticWrite(Long presentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
SELECT p
FROM Present p
WHERE p.receiver.id = ?1 AND
(?2 IS NULL OR p.claimed = ?2)
""")
    List<Present> findByReceiverIdClaimedForPessimisticWrite(Long receiverId, Boolean claimed);
}
