package com.example.phantom.ton.withdrawal;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.ton.TonConstants;
import com.example.phantom.ton.TonTransferStatus;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

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
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, length = TonConstants.ADDRESS_LENGTH)
    private String receiver;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = TonConstants.TRANSFER_STATUS_MAX_LENGTH)
    private TonTransferStatus status;

    @Column(unique = true, length = TonConstants.TX_HASH_MAX_LENGTH)
    private String hash;
}
