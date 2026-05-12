package com.example.phantom.game.thecase;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.game.util.ProvablyFairProvider;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.math.BigDecimal;

@Entity
@Table(name = "case_game_logs", indexes = {
        @Index(name = "idx_case_game_logs_user_id", columnList = "user_id"),
        @Index(name = "idx_case_game_logs_timestamp", columnList = "timestamp"),
        @Index(name = "idx_case_game_logs_result", columnList = "result")
})
@Getter
@Setter
@NoArgsConstructor
public class CaseGameLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name="user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, length = CaseConstants.CASE_NAME_MAX_LENGTH)
    private String caseName;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal result;

    @Column(nullable = false, length = ProvablyFairProvider.SEED_LENGTH)
    private String serverSeed;

    @Column(nullable = false, length = ProvablyFairProvider.SEED_LENGTH)
    private String clientSeed;
}
