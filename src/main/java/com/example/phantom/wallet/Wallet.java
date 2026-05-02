package com.example.phantom.wallet;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.math.BigDecimal;
import com.example.phantom.money.MoneyConstants;

@Entity
@Table(name = "wallets")
@Getter
@Setter
@NoArgsConstructor
public class Wallet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", unique = true)
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User user;

    @Column(nullable = false, precision = MoneyConstants.PRECISION, scale = MoneyConstants.SCALE)
    private BigDecimal balance;

    @Column(nullable = false, precision = MoneyConstants.PRECISION, scale = MoneyConstants.SCALE)
    private BigDecimal depositsSum;

    @Column(nullable = false, unique = true, length = WalletConstants.ADDRESS_LENGTH)
    private String depositAddress;

    @Column(nullable = false, length = WalletConstants.PRIVATE_KEY_LENGTH)
    private String depositPrivateKey;
}