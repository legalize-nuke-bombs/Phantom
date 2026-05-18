package com.example.phantom.experience.experiencechange;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(
        name = "experience_changes",
        indexes = {
                @Index(name = "idx_experience_changes_user_id", columnList = "user_id"),
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ExperienceChange {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false)
    private Long amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExperienceChangeType type;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false)
    private String details;
}
