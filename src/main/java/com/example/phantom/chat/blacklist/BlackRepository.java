package com.example.phantom.chat.blacklist;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface BlackRepository extends JpaRepository<Black, Long> {
    Optional<Black> findByAuthor_IdAndTarget_Id(Long authorId, Long targetId);

    @Query("SELECT b FROM Black b WHERE b.author.id = ?1 AND (?2 IS NULL OR b.id < ?2) ORDER BY b.id DESC")
    List<Black> findByAuthorId(Long authorId, Long before, Pageable pageable);
}
