package com.example.phantom.game;

import com.example.phantom.user.UserRepresentation;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.Map;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GameRepresentation {
    private final Long id;
    private final UserRepresentation user;
    private final GameType gameType;
    private final Long timestamp;
    private final BigDecimal bet;
    private final BigDecimal result;
    private final String serverSeed;
    private final String clientSeed;
    private final Map<String, Object> data;

    public GameRepresentation(Game game) {
        this.id = game.getId();
        this.user = new UserRepresentation(game.getUser());
        this.gameType = game.getGameType();
        this.timestamp = game.getTimestamp();
        this.bet = game.getBet();
        this.result = game.getResult();
        this.serverSeed = game.getServerSeed();
        this.clientSeed = game.getClientSeed();
        this.data = game.getData();
    }
}
