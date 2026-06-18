package com.example.phantom.notification.topic;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TopicMemberRepository extends JpaRepository<TopicMember, Long> {
    @Query("SELECT tm FROM TopicMember tm JOIN FETCH tm.user WHERE tm.topic.id = ?1")
    List<TopicMember> findByTopicIdWithUsers(String topicID);

    @Query("SELECT tm FROM TopicMember tm JOIN FETCH tm.user JOIN FETCH tm.topic WHERE tm.topic.id IN ?1")
    List<TopicMember> findByTopicIdsWithUsersTopics(List<String> topicIds);

    @Query("SELECT tm FROM TopicMember tm JOIN FETCH tm.topic WHERE tm.user.id = ?1")
    List<TopicMember> findByUserIdWithTopics(Long userId);

    @Query("SELECT CASE WHEN COUNT(tm) > 0 THEN true ELSE false END FROM TopicMember tm WHERE tm.topic.id = ?1 AND tm.user.id = ?2")
    boolean existsByTopicIdUserId(String topicId, Long userId);

    @Query("SELECT COUNT(tm) FROM TopicMember tm WHERE tm.topic.id = ?1")
    long countByTopicId(String topicId);

    @Query("SELECT tm FROM TopicMember tm JOIN FETCH tm.user WHERE tm.topic.id = ?1 ORDER BY tm.timestamp ASC, tm.id ASC")
    List<TopicMember> findEldest(String topicId, Pageable pageable);

    @Modifying
    @Query("DELETE FROM TopicMember tm WHERE tm.topic.id = ?1 AND tm.user.id = ?2")
    void deleteByTopicIdUserId(String topicId, Long userId);
}
