package com.example.phantom.game.upgrader;

import com.example.phantom.game.util.ProvablyFairProvider;
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
@Table(name = "upgrader_games")
@Getter
@Setter
@NoArgsConstructor
public class UpgraderGame {
    @Id
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name="user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal bet;

    @Column(nullable = false)
    private Integer percent;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal possibleResult;

    @Column(nullable = false, length = ProvablyFairProvider.SEED_LENGTH)
    private String serverSeed;
}