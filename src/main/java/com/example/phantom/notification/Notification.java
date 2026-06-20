package com.example.phantom.notification;

import com.example.phantom.notification.topic.Topic;
import com.example.phantom.user.User;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "notifications", indexes = {
        @Index(name = "idx_notifications_published", columnList = "published"),
        @Index(name = "idx_notifications_destination_user_id", columnList = "destination_user_id"),
        @Index(name = "idx_notifications_topic_id", columnList = "topic_id"),
        @Index(name = "idx_notifications_timestamp", columnList = "timestamp")
})
@Getter
@Setter
@NoArgsConstructor
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Boolean published;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationDestinationType destinationType;

    @ManyToOne
    @JoinColumn(name = "destination_user_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User destinationUser;

    @ManyToOne
    @JoinColumn(name = "topic_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Topic destinationTopic;

    @Column(nullable = false)
    private Long timestamp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private JsonNode payload;
}
