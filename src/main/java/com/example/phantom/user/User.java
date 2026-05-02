package com.example.phantom.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = UserValidationConstants.USERNAME_MAX_LENGTH)
    private String username;

    @Column(nullable = false, length = UserValidationConstants.DISPLAY_NAME_MAX_LENGTH)
    private String displayName;

    @Column(nullable = false, length = UserValidationConstants.PASSWORD_HASH_LENGTH)
    private String passwordHash;
}