package com.example.phantom.notification;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT n From Notification n WHERE n.published = ?1")
    List<Notification> findByPublishedForPessimisticWrite(Boolean published);

    @Query("""
SELECT n
FROM Notification n
WHERE n.destinationType = ?1 AND
n.destinationUser.id = ?2 AND
(?3 IS NULL OR n.id < ?3)
ORDER BY n.id DESC
""")
    List<Notification> findByDestinationTypeDestinationUserId(NotificationDestinationType destinationType, Long destinationUserId, Long before, Pageable pageable);
}
