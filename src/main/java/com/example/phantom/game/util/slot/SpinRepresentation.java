package com.example.phantom.game.util.slot;

import java.math.BigDecimal;
import java.util.List;

public record SpinRepresentation(String[][] data, List<PatternMatch> patternMatches, BigDecimal k) {
}
