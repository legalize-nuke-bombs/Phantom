package com.example.phantom.topic;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TopicRepository extends JpaRepository<Topic, String> {

    @Query("""
SELECT t.id
FROM Topic t
WHERE (:topicId IS NULL OR t.id = :topicId) AND
(:before IS NULL OR t.id < :before)
AND (
t.allowAuthorized
OR (t.allowChatModerators AND :chatModeratorAccess = true)
OR (t.allowOwners AND :ownerAccess = true)
OR (t.allowCustomMembers AND EXISTS (
SELECT 1 FROM TopicMember m
WHERE m.topic.id = t.id AND m.user.id = :userId
))
)
ORDER BY t.id DESC
""")
    List<String> findAccessibleTopicIds(
            @Param("chatModeratorAccess") boolean chatModeratorAccess,
            @Param("ownerAccess") boolean ownerAccess,
            @Param("userId") Long userId,
            @Param("topicId") String topicId,
            @Param("before") String before,
            Pageable pageable
    );
}
