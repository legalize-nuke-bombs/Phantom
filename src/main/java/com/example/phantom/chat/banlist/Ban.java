package com.example.phantom.chat.banlist;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;

@Entity
@Table(name = "bans")
@Getter
@Setter
@NoArgsConstructor
public class Ban {
    @Id
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false)
    private Long timestamp;

    @ManyToOne
    @JoinColumn(name = "moderator_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User moderator;

    @Column(nullable = false)
    private Long duration;

    @Column(nullable = false, length = BanlistConstants.MAX_REASON_LENGTH)
    private String reason;

    public boolean isActive() {
        return (timestamp + duration > Instant.now().getEpochSecond());
    }
}
