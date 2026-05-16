package com.example.phantom.game.util.slot;

import java.math.BigDecimal;

public record Slot(String name, BigDecimal probability, BigDecimal k) {
    public Slot {
        if (name == null || name.isBlank()) {
            throw new SlotsException("slot name is empty");
        }

        if (probability == null) {
            throw new SlotsException("slot provability is null");
        }
        if (probability.compareTo(BigDecimal.ZERO) <= 0 || probability.compareTo(BigDecimal.ONE) > 0) {
            throw new SlotsException("slot provability must be in (0, 1]");
        }

        if (!name.equals("wild")) {
            if (k == null) {
                throw new SlotsException("slot k is null");
            }
            if (k.compareTo(BigDecimal.ZERO) <= 0) {
                throw new SlotsException("slot k must be positive");
            }
        }
    }

    public static Slot buildWildSlot(BigDecimal probability) {
        return new Slot(
                "wild",
                probability,
                null
        );
    }
}
