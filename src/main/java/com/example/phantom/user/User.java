package com.example.phantom.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users",
        indexes = {
                @Index(name = "idx_users_gameHistoryPrivacySetting", columnList = "gameHistoryPrivacySetting"),
                @Index(name = "idx_users_experiencePrivacySetting", columnList = "experiencePrivacySetting")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = UserConstants.USERNAME_MAX_LENGTH)
    private String username;

    @Column(nullable = false, length = UserConstants.DISPLAY_NAME_MAX_LENGTH)
    private String displayName;

    @Column(nullable = false)
    private Long registeredAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacySetting gameHistoryPrivacySetting;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacySetting gameStatsPrivacySetting;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacySetting experiencePrivacySetting;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacySetting lotteryPrivacySetting;

    @Column(nullable = false, length = UserConstants.BCRYPT_HASH_LENGTH)
    private String passwordHash;

    @Column(nullable = false, unique = true, length = RecoveryKeyService.RECOVERY_KEY_PART_LENGTH)
    private String publicRecoveryKey;

    @Column(nullable = false, length = UserConstants.BCRYPT_HASH_LENGTH)
    private String privateRecoveryKeyHash;
}