package com.example.phantom.crypto.withdrawal;

import com.example.phantom.crypto.TransferStatus;
import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.math.BigDecimal;

@Entity
@Table(name = "withdrawals", indexes = {
        @Index(name = "idx_withdrawals_user_id", columnList = "user_id"),
        @Index(name = "idx_withdrawals_status", columnList = "status"),
        @Index(name = "idx_withdrawals_timestamp", columnList = "timestamp")
})
@Getter
@Setter
@NoArgsConstructor
public class Withdrawal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false, length = 20)
    private String coin;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, length = 128)
    private String receiver;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TransferStatus status;

    @Column(unique = true, length = 128)
    private String hash;
}
