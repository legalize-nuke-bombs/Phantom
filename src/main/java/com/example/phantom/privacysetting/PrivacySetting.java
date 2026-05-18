package com.example.phantom.privacysetting;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(
        name = "privacy_settings",
        indexes = {
                @Index(name = "idx_privacy_settings_game_history_privacy_param", columnList = "gameHistoryPrivacyParam")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class PrivacySetting {
    @Id
    @Column(name = "user_id")
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacyParam experiencePrivacyParam;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacyParam walletBalancePrivacyParam;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacyParam walletStatsPrivacyParam;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacyParam walletHistoryPrivacyParam;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacyParam gameHistoryPrivacyParam;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacyParam gameStatsPrivacyParam;
}
