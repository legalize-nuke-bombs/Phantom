package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.type.SqlTypes;
import java.util.Map;

@Entity
@Table(name = "chat_moderator_actions")
@Getter
@Setter
public class ChatModeratorAction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User user;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, length = ChatModeratorActionConstants.ACTION_MAX_LENGTH)
    private String action;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, String> data;
}
