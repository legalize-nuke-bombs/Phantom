package com.example.phantom.owner.sweep;

import com.example.phantom.finance.FinanceConstants;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "sweep_logs")
@Getter
@Setter
public class SweepLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, length = SweepLogConstants.COIN_MAX_LENGTH)
    private String coin;

    @Column(nullable = false, length = SweepLogConstants.SENDER_MAX_LENGTH)
    private String sender;

    @Column(nullable = false, length = SweepLogConstants.RECEIVER_MAX_LENGTH)
    private String receiver;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal amount;

    @Column(nullable = false, length = SweepLogConstants.STATUS_MAX_LENGTH)
    private String status;
}
