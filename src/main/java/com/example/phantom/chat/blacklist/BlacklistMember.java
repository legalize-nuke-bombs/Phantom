package com.example.phantom.chat.blacklist;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "blacklist_members", indexes = {
        @Index(name = "idx_blacklist_members_blacklist_id", columnList = "blacklist_id"),
        @Index(name = "idx_blacklist_members_user_id", columnList = "user_id")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = {"blacklist_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class BlacklistMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "blacklist_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Blacklist blacklist;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;
}
