package com.example.phantom.chat.blacklist;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "blacks", indexes = {
        @Index(name = "idx_blacks_author_id", columnList = "author_id"),
        @Index(name = "idx_blacks_target_id", columnList = "target_id")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = {"author_id", "target_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class Black {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long timestamp;

    @ManyToOne
    @JoinColumn(name = "author_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User author;

    @ManyToOne
    @JoinColumn(name = "target_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User target;
}
