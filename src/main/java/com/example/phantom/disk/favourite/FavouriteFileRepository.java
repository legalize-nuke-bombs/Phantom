package com.example.phantom.disk.favourite;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface FavouriteFileRepository extends JpaRepository<FavouriteFile, Long> {
    @Query("""
SELECT ff
FROM FavouriteFile ff
JOIN FETCH ff.file f
JOIN FETCH f.user
WHERE ff.user.id = ?1 AND
(?2 IS NULL OR ff.timestamp < ?2)
ORDER BY ff.timestamp DESC
""")
    List<FavouriteFile> findAllWithFileAndFileUsers(Long userId, Long before, Pageable pageable);

    @Modifying
    @Query("DELETE FavouriteFile ff WHERE ff.user.id = ?1 AND ff.file.id = ?2")
    void deleteByUserIdFileId(Long userId, UUID fileId);
}
