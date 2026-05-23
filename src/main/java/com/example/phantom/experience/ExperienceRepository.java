package com.example.phantom.experience;

import com.example.phantom.user.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ExperienceRepository extends JpaRepository<Experience, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Experience e WHERE e.id = ?1")
    Optional<Experience> findByIdForPessimisticWrite(Long experienceId);

    @Query("""
    SELECT e.user FROM Experience e
    ORDER BY e.amountCached DESC, e.user.id DESC
""")
    List<User> findLeaderboardUsers(Pageable pageable);

    @Query("""
    SELECT e.user FROM Experience e
    WHERE (e.amountCached < ?1 OR (e.amountCached = ?1 AND e.user.id < ?2))
    ORDER BY e.amountCached DESC, e.user.id DESC
""")
    List<User> findLeaderboardUsersBefore(Long beforeAmount, Long beforeUserId, Pageable pageable);
}
