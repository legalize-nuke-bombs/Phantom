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
    WHERE (e.user.id = ?1 OR e.user.experiencePrivacySetting = com.example.phantom.user.PrivacySetting.EVERYONE)
    ORDER BY e.amountCached DESC, e.user.id DESC
""")
    List<User> findBestUsersUsingPrivacyPolicy(Long viewerId, Pageable pageable);

    @Query("""
    SELECT e.user FROM Experience e
    WHERE (e.user.id = ?1 OR e.user.experiencePrivacySetting = com.example.phantom.user.PrivacySetting.EVERYONE) AND
    (e.amountCached < ?2 OR (e.amountCached = ?2 AND e.user.id < ?3))
    ORDER BY e.amountCached DESC, e.user.id DESC
""")
    List<User> findBestUsersUsingPrivacyPolicyBefore(Long viewerId, Long beforeAmount, Long beforeUserId, Pageable pageable);
}
