package com.example.phantom.stat;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class PersonalStatRepresentation {
    private Long upgraderGames;
    private BigDecimal upgradeGameMaxResult;

    private Long caseGames;
    private BigDecimal caseGameMaxResult;
}
