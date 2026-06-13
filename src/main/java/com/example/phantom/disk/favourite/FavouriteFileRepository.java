package com.example.phantom.disk.favourite;

import com.example.phantom.disk.File;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface FavouriteFileRepository extends JpaRepository<FavouriteFile, Long> {
    @Query("""
SELECT ff.file
FROM FavouriteFile ff
JOIN FETCH ff.file.user
WHERE ff.user.id = ?1 AND
(?2 IS NULL OR ff.id < ?2)
""")
    List<File> findFilesWithUsers(Long userId, Long before, Pageable pageable);
}
