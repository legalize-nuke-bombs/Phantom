package com.example.phantom.game.thecase;

import com.example.phantom.game.util.ProvablyFairProvider;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name="case_games")
@Getter
@Setter
@NoArgsConstructor
public class CaseGame {
    @Id
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false, length = CaseConstants.CASE_NAME_MAX_LENGTH)
    private String caseName;

    @Column(nullable = false, length = ProvablyFairProvider.SEED_LENGTH)
    private String serverSeed;
}
