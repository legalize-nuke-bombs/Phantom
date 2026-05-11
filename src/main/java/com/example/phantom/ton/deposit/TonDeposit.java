package com.example.phantom.ton.deposit;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.ton.TonConstants;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.math.BigDecimal;

@Entity
@Table(name = "ton_deposits")
@Getter
@Setter
@NoArgsConstructor
public class TonDeposit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, unique = true, length = TonConstants.TX_HASH_MAX_LENGTH)
    private String txHash;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal amount;
}
