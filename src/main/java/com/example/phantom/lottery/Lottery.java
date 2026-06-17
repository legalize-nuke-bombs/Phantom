package com.example.phantom.lottery;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.provablyfair.ProvablyFairService;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.math.BigDecimal;

@Entity
@Table(name = "lotteries")
@Getter
@Setter
@NoArgsConstructor
public class Lottery {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long timestamp;

    @Column
    private Long timestampNotificationEnding;

    @Column
    private Boolean notificationEndingFired;

    @Column(nullable = false)
    private Long timestampBlock;

    @Column(nullable = false)
    private Long timestampEnd;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal ticketCost;

    @Column(nullable = false, length = ProvablyFairService.SEED_LENGTH)
    private String seed1;

    @Column(nullable = false, length = ProvablyFairService.SEED_LENGTH)
    private String seed2;

    @ManyToOne
    @JoinColumn(name = "winner_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User winner;

    @Column
    private Long happyTicket;

    @Column(precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal prize;

    @Column
    private Long ticketsAmountTotal;
}
