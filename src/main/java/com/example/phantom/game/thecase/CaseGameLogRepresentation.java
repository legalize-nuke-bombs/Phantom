package com.example.phantom.game.thecase;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class CaseGameLogRepresentation {
    private final Long timestamp;
    private final String caseName;
    private final BigDecimal result;
    private final String serverSeed;
    private final String clientSeed;

    public CaseGameLogRepresentation(CaseGameLog caseGameLog) {
        this.timestamp = caseGameLog.getTimestamp();
        this.caseName = caseGameLog.getCaseName();
        this.result = caseGameLog.getResult();
        this.serverSeed = caseGameLog.getServerSeed();
        this.clientSeed = caseGameLog.getClientSeed();
    }
}
