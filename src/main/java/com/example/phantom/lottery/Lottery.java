package com.example.phantom.lottery;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.provablyfair.ProvablyFairProvider;
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

    @Column(nullable = false, length = ProvablyFairProvider.SEED_LENGTH)
    private String seed;

    @ManyToOne
    @JoinColumn(name = "winner_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User winner;

    @Column(precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal prize;

    @Column
    private Long ticketsAmountTotal;
}
