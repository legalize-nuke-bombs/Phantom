package com.example.phantom.experience;

import com.example.phantom.user.PrivacySetting;
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

    @Query("SELECT e FROM Experience e JOIN FETCH e.user WHERE e.user.experiencePrivacySetting = ?1 ORDER BY e.amountCached DESC")
    List<Experience> findLeaderboardWithUsers(PrivacySetting experiencePrivacySetting, Pageable pageable);

    @Query("SELECT e FROM Experience e JOIN FETCH e.user WHERE e.user.experiencePrivacySetting = ?1 AND e.amountCached < ?2 ORDER BY e.amountCached DESC")
    List<Experience> findLeaderboardWithUsersBefore(PrivacySetting experiencePrivacySetting, Long beforeAmount, Pageable pageable);
}
