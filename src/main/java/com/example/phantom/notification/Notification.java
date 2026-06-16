package com.example.phantom.notification;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "notifications", indexes = {
        @Index(name = "idx_notifications_published", columnList = "published"),
        @Index(name = "idx_notifications_destination_user_id_type", columnList = "destination_user_id, type")
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

    @Column(nullable = false)
    private Long timestamp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column
    private Object payload;
}
