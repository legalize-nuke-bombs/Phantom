package com.example.phantom.chat.chatmoderatoraction;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ChatModeratorActionRepository extends JpaRepository<ChatModeratorAction, Long> {
    @Query("SELECT a FROM ChatModeratorAction a JOIN FETCH a.user ORDER BY a.id DESC")
    List<ChatModeratorAction> findAllWithUsersPageable(Pageable pageable);

    @Query("SELECT a FROM ChatModeratorAction a JOIN FETCH a.user WHERE a.id < ?1 ORDER BY a.id DESC")
    List<ChatModeratorAction> findAllBeforeWithUsersPageable(Long before, Pageable pageable);
}
