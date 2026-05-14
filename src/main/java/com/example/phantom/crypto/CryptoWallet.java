package com.example.phantom.crypto;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "crypto_wallets", indexes = {
        @Index(name = "idx_crypto_wallets_user_id", columnList = "user_id")
})
@Getter
@Setter
@NoArgsConstructor
public class CryptoWallet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false, length = 20)
    private String coin;

    @Column(nullable = false, length = 500)
    private String mnemonic;

    @Column(nullable = false, length = 128)
    private String address;

    @Column(nullable = false, length = 128)
    private String privateKey;
}
