package com.example.phantom.chat.message;

import com.example.phantom.chat.chat.Chat;
import com.example.phantom.disk.File;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "messages", indexes = {
        @Index(name = "idx_messages_user_id", columnList = "user_id"),
        @Index(name = "idx_messages_chat_id", columnList = "chat_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne
    @JoinColumn(name = "chat_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Chat chat;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, length = MessageConstants.MAX_MESSAGE_CONTENT_LENGTH)
    private String content;

    @ManyToOne
    @JoinColumn(name = "attachment_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private File attachment;
}
