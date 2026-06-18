package com.example.phantom.chat.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ChatRepository extends JpaRepository<Chat, Long> {
    @Query("SELECT c FROM Chat c JOIN FETCH c.topic WHERE c.topic.id IN ?1 AND (?2 IS NULL OR c.topic.timestamp < ?2) ORDER by c.topic.timestamp DESC")
    List<Chat> findByTopicIdsWithTopics(List<String> topicIds, Long before, Pageable pageable);
}
