package com.example.phantom.wallet.ton;

import com.example.phantom.crypto.ton.TonTransferStatus;
import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "ton_withdrawals", indexes = {
        @Index(name = "idx_ton_withdrawals_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
public class TonWithdrawal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false)
    private String receiver;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TonTransferStatus status;

    @Column(unique = true)
    private String hash;
}
