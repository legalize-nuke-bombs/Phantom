package com.example.phantom.game.thecase;

import com.example.phantom.game.util.FinanceColors;
import com.example.phantom.finance.FinanceConstants;
import lombok.Getter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.TreeMap;

@Getter
public class Case {
    private final String name;
    private final BigDecimal cost;
    private final Integer size;
    private final Map<BigDecimal, Integer> data;

    public Case(String name, int blue, int purple, int pink, int red, int gold, FinanceColors financeColors) {
        this.name = name;

        this.data = new TreeMap<>();
        if (blue > 0) this.data.put(financeColors.getBlue(), blue);
        if (purple > 0) this.data.put(financeColors.getPurple(), purple);
        if (pink > 0) this.data.put(financeColors.getPink(), pink);
        if (red > 0) this.data.put(financeColors.getRed(), red);
        if (gold > 0) this.data.put(financeColors.getGold(), gold);

        Integer size = 0;
        for (Map.Entry<BigDecimal, Integer> entry : this.data.entrySet()) {
            size += entry.getValue();
        }

        BigDecimal cost = new BigDecimal(0);
        for (Map.Entry<BigDecimal, Integer> entry : this.data.entrySet()) {
            BigDecimal fraction = entry.getKey().multiply(new BigDecimal(entry.getValue())).divide(new BigDecimal(size), FinanceConstants.SCALE, RoundingMode.DOWN);
            cost = cost.add(fraction);
        }
        cost = cost.divide(new BigDecimal("0.9"), 1, RoundingMode.DOWN);

        this.cost = cost;
        this.size = size;
    }

    public BigDecimal get(int index) {
        if (index < 0) {
            throw new RuntimeException("case index is out of range");
        }

        for (Map.Entry<BigDecimal, Integer> entry : this.data.entrySet()) {
            BigDecimal key = entry.getKey();
            Integer value = entry.getValue();
            if (value > index) {
                return key;
            }
            index -= value;
        }

        throw new RuntimeException("case index is out of range");
    }
}
