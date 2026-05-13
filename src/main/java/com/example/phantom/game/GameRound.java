package com.example.phantom.game;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.Map;

@Entity
@Table(name = "game_rounds", indexes = {
        @Index(name = "idx_game_rounds_user_id", columnList = "user_id"),
        @Index(name = "idx_game_rounds_timestamp", columnList = "timestamp"),
        @Index(name = "idx_game_rounds_result", columnList = "result")
})
@Getter
@Setter
@NoArgsConstructor
public class GameRound {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameType gameType;

    @Column(precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal bet;

    @Column(precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal result;

    @Column(nullable = false, length = ProvablyFairProvider.SEED_LENGTH)
    private String serverSeed;

    @Column(length = ProvablyFairProvider.SEED_LENGTH)
    private String clientSeed;

    private Long timestamp;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, String> data;
}
