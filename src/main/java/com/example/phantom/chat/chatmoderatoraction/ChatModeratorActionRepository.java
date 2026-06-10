package com.example.phantom.chat.chatmoderatoraction;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ChatModeratorActionRepository extends JpaRepository<ChatModeratorAction, Long> {
    @Query("SELECT a FROM ChatModeratorAction a LEFT JOIN FETCH a.user WHERE (?1 IS NULL OR a.id < ?1) ORDER BY a.id DESC")
    List<ChatModeratorAction> findAllWithUsersPageable(Long before, Pageable pageable);
}
