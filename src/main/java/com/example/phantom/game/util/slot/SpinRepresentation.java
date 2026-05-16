package com.example.phantom.game.util.slot;

import java.math.BigDecimal;
import java.util.List;

public record SpinRepresentation(Slot[][] data, List<PatternMatch> patternMatches, BigDecimal k) {
}
