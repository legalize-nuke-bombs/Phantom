package com.example.phantom.chat.chat;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChatRepository extends JpaRepository<Chat, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Chat c WHERE c.id = ?1")
    Optional<Chat> findByIdForPessimisticWrite(Long chatId);

    @Query("SELECT c FROM Chat c JOIN FETCH c.topic WHERE c.topic.id IN ?1 AND (?2 IS NULL OR c.topic.timestamp < ?2 OR (c.topic.timestamp = ?2 AND c.id < ?3)) ORDER BY c.topic.timestamp DESC, c.id DESC")
    List<Chat> findByTopicIdsWithTopics(List<String> topicIds, Long beforeTimestamp, Long beforeId, Pageable pageable);

    @Query("SELECT c.topic.id FROM Chat c WHERE c.topic.id LIKE '" + PersonalChatConstants.TOPIC_PREFIX + "%' AND NOT EXISTS (SELECT 1 FROM TopicMember tm WHERE tm.topic.id = c.topic.id)")
    List<String> findEmptyChatTopicIds(Pageable pageable);

    @Query("SELECT t.id FROM Topic t WHERE t.id LIKE '" + PersonalChatConstants.TOPIC_PREFIX + "%' AND NOT EXISTS (SELECT 1 FROM Chat c WHERE c.topic.id = t.id)")
    List<String> findAbandonedChatTopicIds(Pageable pageable);
}
