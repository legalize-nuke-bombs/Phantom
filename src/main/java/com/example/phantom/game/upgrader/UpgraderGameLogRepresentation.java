package com.example.phantom.game.upgrader;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class UpgraderGameLogRepresentation {
    private final Long id;
    private final Long timestamp;
    private final BigDecimal bet;
    private final Integer percent;
    private final BigDecimal result;
    private final String serverSeed;
    private final String clientSeed;

    public UpgraderGameLogRepresentation(UpgraderGameLog upgraderGameLog) {
        this.id = upgraderGameLog.getId();
        this.timestamp = upgraderGameLog.getTimestamp();
        this.bet = upgraderGameLog.getBet();
        this.percent = upgraderGameLog.getPercent();
        this.result = upgraderGameLog.getResult();
        this.serverSeed = upgraderGameLog.getServerSeed();
        this.clientSeed = upgraderGameLog.getClientSeed();
    }
}
