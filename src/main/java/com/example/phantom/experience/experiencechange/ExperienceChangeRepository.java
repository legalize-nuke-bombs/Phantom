package com.example.phantom.experience.experiencechange;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ExperienceChangeRepository extends JpaRepository<ExperienceChange, Long> {
    @Query("SELECT e FROM ExperienceChange e WHERE e.user.id = ?1 AND (?2 IS NULL OR e.id < ?2) ORDER BY e.id DESC")
    List<ExperienceChange> findByUserIdPageable(Long userId, Long before, Pageable pageable);
}
