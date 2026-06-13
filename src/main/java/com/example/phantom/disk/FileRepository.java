package com.example.phantom.disk;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface FileRepository extends JpaRepository<File, UUID> {
    @Query("""
SELECT f
FROM File f
JOIN FETCH f.user
WHERE f.user.id = ?1 AND
(?2 IS NULL OR f.timestamp < ?2)
ORDER BY f.timestamp DESC
""")
    List<File> findAllWithUsers(Long userId, Long before, Pageable pageable);
}
