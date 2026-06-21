package com.example.phantom.notification.topic;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@EntityListeners(TopicMemberEventListener.class)
@Table(name = "topic_members", indexes = {
        @Index(name = "idx_topic_members_topic_id", columnList = "topic_id"),
        @Index(name = "idx_topic_members_user_id", columnList = "user_id")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = {"topic_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class TopicMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long timestamp;

    @ManyToOne
    @JoinColumn(name = "topic_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Topic topic;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;
}
