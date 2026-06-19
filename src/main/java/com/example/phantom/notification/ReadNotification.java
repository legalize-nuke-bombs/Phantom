package com.example.phantom.notification;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "read_notifications", indexes = {
        @Index(name = "idx_read_notifications_user_id", columnList = "user_id")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = {"notification_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class ReadNotification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "notification_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Notification notification;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;
}
