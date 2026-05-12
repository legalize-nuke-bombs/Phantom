package com.example.phantom.stat;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class PlatformStatRepresentation {
    private Long upgraderGames;
    private Long upgraderGamesToday;
    private BigDecimal upgraderMaxResult;

    private Long caseGames;
    private Long caseGamesToday;
    private BigDecimal caseMaxResult;

    private BigDecimal tonWithdrawals;
    private BigDecimal tonWithdrawalsToday;

    private Long users;
}
