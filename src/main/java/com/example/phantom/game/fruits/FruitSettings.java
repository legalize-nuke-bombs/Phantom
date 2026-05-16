package com.example.phantom.game.fruits;

import com.example.phantom.game.GameSettings;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
public class FruitSettings implements GameSettings {
    private final FruitSlots slots;
    private final int minBet;

    public FruitSettings(FruitSlots slots) {
        this.slots = slots;
        this.minBet = 1;
    }
}
