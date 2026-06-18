package com.example.phantom.notification.topic;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TopicRepository extends JpaRepository<Topic, String> {

    @Query("""
SELECT t.id
FROM Topic t
WHERE (:topicId IS NULL OR t.id = :topicId)
AND (
t.allowAuthorized
OR (t.allowChatModerators AND :chatModeratorAccess = true)
OR (t.allowOwners AND :ownerAccess = true)
)
""")
    List<String> findAccessibleTopicIds(
            @Param("chatModeratorAccess") boolean chatModeratorAccess,
            @Param("ownerAccess") boolean ownerAccess,
            @Param("topicId") String topicId
    );
}
