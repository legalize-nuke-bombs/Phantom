package com.example.phantom.wallet.balancechange;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.math.BigDecimal;

@Entity
@Table(name = "balance_changes", indexes = {
        @Index(name = "idx_balance_changes_user_id", columnList = "user_id"),
        @Index(name = "idx_balance_changes_type", columnList = "type"),
        @Index(name = "idx_balance_changes_timestamp", columnList = "timestamp")
})
@Getter
@Setter
@NoArgsConstructor
public class BalanceChange {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BalanceChangeType type;

    @Column(nullable = false)
    private Long timestamp;
}
