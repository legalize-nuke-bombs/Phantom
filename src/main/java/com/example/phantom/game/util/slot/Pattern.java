package com.example.phantom.game.util.slot;

import java.math.BigDecimal;

public record Pattern(String name, BigDecimal k, int[][] data) {
    public Pattern {
        if (name == null || name.isBlank()) {
            throw new SlotsException("pattern name is empty");
        }

        if (k == null) {
            throw new SlotsException("pattern k is null");
        }
        if (k.compareTo(BigDecimal.ZERO) <= 0) {
            throw new SlotsException("pattern k must be positive");
        }

        if (data == null) {
            throw new SlotsException("pattern data is null");
        }
        for (int y = 1; y < data.length; y++) {
            if (data[0].length != data[y].length) {
                throw new SlotsException("bad pattern data");
            }
        }
    }
}
