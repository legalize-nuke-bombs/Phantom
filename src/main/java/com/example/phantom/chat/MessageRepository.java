package com.example.phantom.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    @Query("SELECT m FROM Message m JOIN FETCH m.user u ORDER BY m.id DESC")
    List<Message> findAllWithUsersPageable(Pageable pageable);

    @Query("SELECT m FROM Message m JOIN FETCH m.user u WHERE m.id < ?1 ORDER BY m.id DESC")
    List<Message> findAllBeforeWithUsersPageable(Long before, Pageable pageable);
}
