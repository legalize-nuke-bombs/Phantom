package com.example.phantom.game;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.Map;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GameRoundRepresentation {
    private final Long id;
    private final GameType gameType;
    private final Long timestamp;
    private final BigDecimal bet;
    private final BigDecimal result;
    private final String serverSeed;
    private final String clientSeed;
    private final Map<String, String> data;

    public GameRoundRepresentation(GameRound round) {
        this.id = round.getId();
        this.gameType = round.getGameType();
        this.timestamp = round.getTimestamp();
        this.bet = round.getBet();
        this.result = round.getResult();
        this.serverSeed = round.getServerSeed();
        this.clientSeed = round.getClientSeed();
        this.data = round.getData();
    }
}
