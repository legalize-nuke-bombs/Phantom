package com.example.phantom.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_registered_at", columnList = "registered_at")
})
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
    private PrivacySetting walletBalancePrivacySetting;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacySetting walletStatsPrivacySetting;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacySetting walletHistoryPrivacySetting;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacySetting gameHistoryPrivacySetting;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrivacySetting gameStatsPrivacySetting;

    @Column(nullable = false, length = UserConstants.BCRYPT_HASH_LENGTH)
    private String passwordHash;

    @Column(nullable = false, unique = true, length = RecoveryKeyProvider.RECOVERY_KEY_PART_LENGTH)
    private String publicRecoveryKey;

    @Column(nullable = false, length = UserConstants.BCRYPT_HASH_LENGTH)
    private String privateRecoveryKeyHash;

    public Plan getPlan() {
        switch (role) {
            case CHAT_MODERATOR -> {
                return Plan.PRO;
            }
            case OWNER -> {
                return Plan.MAX;
            }
            default -> {
                return Plan.DEFAULT;
            }
        }
    }
}