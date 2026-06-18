package com.example.phantom.chat.message;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    @Query("SELECT m FROM Message m LEFT JOIN FETCH m.attachment JOIN FETCH m.user u WHERE m.chat.id = ?1 AND (?2 IS NULL OR m.id < ?2) ORDER BY m.id DESC")
    List<Message> findByChatIdWithAttachmentsAndUsersPageable(Long chatId, Long before, Pageable pageable);
}
