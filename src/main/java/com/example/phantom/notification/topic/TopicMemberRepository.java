package com.example.phantom.notification.topic;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TopicMemberRepository extends JpaRepository<TopicMember, Long> {
    @Query("SELECT tm FROM TopicMember tm JOIN FETCH tm.user WHERE tm.topic.id = ?1")
    List<TopicMember> findByTopicIdWithUsers(String topicID);

    @Query("SELECT tm FROM TopicMember tm JOIN FETCH tm.user JOIN FETCH tm.topic WHERE tm.topic.id IN ?1")
    List<TopicMember> findByTopicIdsWithUsersTopics(List<String> topicIds);

    @Query("SELECT tm FROM TopicMember tm JOIN FETCH tm.topic WHERE tm.user.id = ?1")
    List<TopicMember> findByUserIdWithTopics(Long userId);
}
