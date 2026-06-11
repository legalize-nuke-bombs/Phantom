package com.example.phantom.lottery;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "lottery_bets",
        indexes = {
                @Index(name = "idx_lottery_bets_lottery_id", columnList = "lottery_id"),
                @Index(name = "idx_lottery_bets_user_id", columnList = "user_id"),
                @Index(name = "idx_lottery_bets_tickets_id", columnList = "tickets, id")
        },

        uniqueConstraints = {
        @UniqueConstraint(
                name = "uk_lottery_bets_lottery_id_user_id",
                columnNames = {"lottery_id", "user_id"}
        )
        }
)
@Getter
@Setter
@NoArgsConstructor
public class LotteryBet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "lottery_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Lottery lottery;

    @ManyToOne
    @JoinColumn(name = "user_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private User user;

    @Column(nullable = false)
    private Long tickets;
}
