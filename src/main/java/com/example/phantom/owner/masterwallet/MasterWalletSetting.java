package com.example.phantom.owner.masterwallet;

import com.example.phantom.crypto.CoinType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "master_wallet_settings")
@Getter
@Setter
@NoArgsConstructor
public class MasterWalletSetting {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    @Enumerated(EnumType.STRING)
    private CoinType coin;

    @Column
    private String address;

    @Column
    private String privateKey;
}
