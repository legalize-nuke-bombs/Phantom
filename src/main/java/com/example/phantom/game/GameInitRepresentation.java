package com.example.phantom.game;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GameInitRepresentation {
    private String serverHash;
    private BigDecimal possibleResult;
}
