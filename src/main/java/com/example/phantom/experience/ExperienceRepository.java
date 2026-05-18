package com.example.phantom.experience;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface ExperienceRepository extends JpaRepository<Experience, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Experience e WHERE e.id = ?1")
    Optional<Experience> findByIdForPessimisticWrite(Long experienceId);
}
