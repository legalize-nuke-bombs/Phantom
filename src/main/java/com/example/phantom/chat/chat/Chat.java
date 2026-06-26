package com.example.phantom.chat.chat;

import com.example.phantom.topic.Topic;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.util.UUID;

@Entity
@Table(name = "chats")
@Getter
@Setter
@NoArgsConstructor
public class Chat {
    @Id
    private UUID id;

    @OneToOne
    @JoinColumn(name = "topic_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Topic topic;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ChatType type;

    @Column
    private String name;

    @Column(nullable = false)
    private Long lastEdit;
}
