package com.example.phantom.wallet.ton;

import com.example.phantom.crypto.ton.TonApiService;
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
    @OnDelete(action = OnDeleteAction.SET_NULL) // NO CASCADE !!!
    private User user;

    @Column(nullable = false)
    private String mnemonic;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TonApiService.WalletVersion walletVersion;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private String privateKey;
}
