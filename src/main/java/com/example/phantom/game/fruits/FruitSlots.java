package com.example.phantom.game.fruits;

import com.example.phantom.game.GameSettings;
import com.example.phantom.game.util.slot.*;
import com.example.phantom.game.util.slot.phantomslots.SimpleSlots;
import lombok.Getter;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@Getter
public class FruitSlots implements GameSettings {
    private final Slots slots;

    public FruitSlots() {
        this.slots = new SimpleSlots(3, 5);

        this.slots.registerSlot(new Slot("plum", new BigDecimal("0.35"), new BigDecimal("1")));
        this.slots.registerSlot(new Slot("grape", new BigDecimal("0.35"), new BigDecimal("1")));
        this.slots.registerSlot(new Slot("seven", new BigDecimal("0.15"), new BigDecimal("10")));
        this.slots.registerSlot(Slot.buildWildSlot(new BigDecimal("0.15")));

        this.slots.registerPattern(new Pattern("column1", new BigDecimal("0.05"),
                new int[][]{
                        {1, 0, 0, 0, 0},
                        {1, 0, 0, 0, 0},
                        {1, 0, 0, 0, 0}
                }
        ));
        this.slots.registerPattern(new Pattern("column2", new BigDecimal("0.05"),
                new int[][]{
                        {0, 1, 0, 0, 0},
                        {0, 1, 0, 0, 0},
                        {0, 1, 0, 0, 0}
                }
        ));
        this.slots.registerPattern(new Pattern("column3", new BigDecimal("0.05"),
                new int[][]{
                        {0, 0, 1, 0, 0},
                        {0, 0, 1, 0, 0},
                        {0, 0, 1, 0, 0}
                }
        ));
        this.slots.registerPattern(new Pattern("column4", new BigDecimal("0.05"),
                new int[][]{
                        {0, 0, 0, 1, 0},
                        {0, 0, 0, 1, 0},
                        {0, 0, 0, 1, 0}
                }
        ));
        this.slots.registerPattern(new Pattern("column5", new BigDecimal("0.05"),
                new int[][]{
                        {0, 0, 0, 0, 1},
                        {0, 0, 0, 0, 1},
                        {0, 0, 0, 0, 1}
                }
        ));

        this.slots.registerPattern(new Pattern("row1", new BigDecimal("0.1"),
                new int[][]{
                        {0, 0, 0, 0, 0},
                        {1, 1, 1, 1, 1},
                        {0, 0, 0, 0, 0}
                }
        ));
        this.slots.registerPattern(new Pattern("row2", new BigDecimal("0.1"),
                new int[][]{
                        {0, 0, 0, 0, 0},
                        {1, 1, 1, 1, 1},
                        {0, 0, 0, 0, 0}
                }
        ));
        this.slots.registerPattern(new Pattern("row3", new BigDecimal("0.1"),
                new int[][]{
                        {0, 0, 0, 0, 0},
                        {0, 0, 0, 0, 0},
                        {1, 1, 1, 1, 1}
                }
        ));

        this.slots.registerPattern(new Pattern("arrowUp", new BigDecimal("2"),
                new int[][]{
                        {0, 0, 1, 0, 0},
                        {0, 1, 0, 1, 0},
                        {1, 0, 0, 0, 1}
                }
        ));
        this.slots.registerPattern(new Pattern("arrowDown", new BigDecimal("2"),
                new int[][]{
                        {1, 0, 0, 0, 1},
                        {0, 1, 0, 1, 0},
                        {0, 0, 1, 0, 0}
                }
        ));

        this.slots.registerPattern(new Pattern("eye", new BigDecimal("20"),
                new int[][] {
                        {0, 1, 1, 1, 0},
                        {1, 0, 0, 0, 1},
                        {0, 1, 1, 1, 0}
                }
        ));

        this.slots.registerPattern(new Pattern("triangleUp", new BigDecimal("25"),
                new int[][]{
                        {0, 0, 1, 0, 0},
                        {0, 1, 1, 1, 0},
                        {1, 1, 1, 1, 1}
                }
        ));
        this.slots.registerPattern(new Pattern("triangleDown", new BigDecimal("25"),
                new int[][]{
                        {1, 1, 1, 1, 1},
                        {0, 1, 1, 1, 0},
                        {0, 0, 1, 0, 0}
                }
        ));

        this.slots.registerPattern(new Pattern("jackpot", new BigDecimal("1000"),
                new int[][] {
                        {1, 1, 1, 1, 1},
                        {1, 1, 1, 1, 1},
                        {1, 1, 1, 1, 1}
                }
        ));

        this.slots.validate();

        // this.slots.estimate(10_000_000);
    }
}
