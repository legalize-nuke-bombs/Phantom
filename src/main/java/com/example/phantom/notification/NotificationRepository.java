package com.example.phantom.notification;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT n From Notification n WHERE n.published = ?1")
    List<Notification> findByPublishedForPessimisticWrite(Boolean published);

    @Query("""
SELECT n
FROM Notification n
WHERE (
(n.destinationType = :destinationTypeUser AND
n.destinationUser IS NOT NULL AND
n.destinationUser.id = :userId)
OR
(n.destinationType = :destinationTypeTopic AND
n.destinationTopic IS NOT NULL AND
n.destinationTopic.id IN :accessibleTopicIds))
AND
(:before IS NULL OR n.id < :before)
ORDER BY n.id DESC
""")
    List<Notification> findRelevant(
            @Param("destinationTypeUser") NotificationDestinationType destinationTypeUser,
            @Param("destinationTypeTopic") NotificationDestinationType destinationTypeTopic,

            @Param("userId") Long userId,

            @Param("accessibleTopicIds") List<String> accessibleTopicIds,

            @Param("before") Long before,
            Pageable pageable
    );
}
