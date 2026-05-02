package com.example.phantom.game.upgrader;

import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter
@Setter
public class UpgraderInitRepresentation {
    private BigDecimal possibleResult;
    private String serverHash;
}
