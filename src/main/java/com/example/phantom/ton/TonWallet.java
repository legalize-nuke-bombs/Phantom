package com.example.phantom.ton;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "ton_wallets")
@Getter
@Setter
@NoArgsConstructor
public class TonWallet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", unique = true)
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User user;

    @Column(nullable = false, length = TonConstants.MNEMONIC_MAX_LENGTH)
    private String mnemonic;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = TonConstants.WALLET_VERSION_MAX_LENGTH)
    private TonWalletVersion walletVersion;

    @Column(nullable = false, length = TonConstants.ADDRESS_LENGTH)
    private String address;

    @Column(nullable = false, length = TonConstants.PRIVATE_KEY_HEX_LENGTH)
    private String privateKey;
}
