package com.example.phantom.game.util.slot.phantomslots;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.game.util.slot.*;
import lombok.Getter;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Getter
public class SimpleSlots implements Slots {
    private final int height;
    private final int width;
    private final Map<String, Slot> slots;
    private final Map<String, Pattern> patterns;

    private static final int P9_UNIT = 1_000_000_000;

    public SimpleSlots(int height, int width) {
        if (height <= 1) {
            throw new SlotsException("height must be > 1");
        }
        if (width <= 1) {
            throw new SlotsException("width must be > 1");
        }

        this.height = height;
        this.width = width;
        this.slots = new LinkedHashMap<>();
        this.patterns = new LinkedHashMap<>();
    }

    @Override
    public void registerSlot(Slot slot) {
        slots.put(slot.name(), slot);
    }

    @Override
    public void registerPattern(Pattern pattern) {
        if (pattern.data().length != height || pattern.data()[0].length != width) {
            throw new SlotsException("pattern size does not match slots size");
        }
        patterns.put(pattern.name(), pattern);
    }

    @Override
    public void validate() {
        if (slots.isEmpty()) {
            throw new SlotsException("slots have not been configured");
        }
        if (slots.values().stream().map(Slot::probability).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(BigDecimal.ONE) != 0) {
            throw new SlotsException("slot sum probability != 1");
        }
    }

    @Override
    public SpinRepresentation spin(Random random) {
        String[][] data = randomData(random);
        List<PatternMatch> patternMatches = patternMatches(data);
        return new SpinRepresentation(
                data,
                patternMatches,
                patternMatches.stream().map(PatternMatch::k).reduce(BigDecimal.ZERO, BigDecimal::add)
        );
    }

    private String[][] randomData(Random random) {
        String[][] data = new String[height][width];

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                data[y][x] = randomSlotName(random);
            }
        }

        return data;
    }

    private String randomSlotName(Random random) {
        int value = random.nextInt(P9_UNIT);

        String last = null;
        for (Slot slot : slots.values()) {
            int p9 = slot.probability().multiply(new BigDecimal(P9_UNIT)).intValue();
            if (p9 > value) {
                return slot.name();
            }
            value -= p9;
            last = slot.name();
        }

        return last;
    }

    private List<PatternMatch> patternMatches(String[][] data) {
        List<PatternMatch> patternMatches = new ArrayList<>();

        for (Pattern pattern : patterns.values()) {
            int[][] patternData = pattern.data();

            Map<String, Slot> patternSlots = new HashMap<>();
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    if (patternData[y][x] > 0) {
                        patternSlots.put(data[y][x], slots.get(data[y][x]));
                    }
                }
            }

            if (patternSlots.size() > 1) {
                patternSlots.remove(Slot.WILD_NAME);
            }

            if (patternSlots.size() == 1) {
                String patternName = pattern.name();
                String slotName = patternSlots.keySet().iterator().next();
                BigDecimal patternK = pattern.k();
                BigDecimal slotK = patternSlots.values().iterator().next().k();
                patternMatches.add(new PatternMatch(patternName, slotName, patternK, slotK, patternK.multiply(slotK)));
            }

        }

        patternMatches.sort(Comparator.comparing(PatternMatch::patternK).thenComparing(PatternMatch::slotK));

        return patternMatches;
    }

    @Override
    public void estimate(int spins) {
        if (spins < 1_000_000) {
            throw new SlotsException("estimate argument is too small");
        }

        Random random = new Random();

        Map<String, Long> map = new LinkedHashMap<>();
        BigDecimal kSum = BigDecimal.ZERO;

        for (int i = 0; i < spins; i++) {
            SpinRepresentation spin = spin(random);
            for (PatternMatch patternMatch : spin.patternMatches()) {
                String key = patternMatch.patternName() + "." + patternMatch.slotName();
                map.put(key, map.getOrDefault(key, 0L) + 1);
            }
            kSum = kSum.add(spin.k());

            if ((i + 1) % 1_000_000 == 0) {
                for (Map.Entry<String, Long> entry : map.entrySet()) {
                    System.out.println(entry.getKey() + ": " + new BigDecimal(entry.getValue()).multiply(new BigDecimal(100)).divide(new BigDecimal(i + 1), FinanceConstants.SCALE, RoundingMode.DOWN) + "%");
                }
                System.out.println("average k: " + kSum.divide(new BigDecimal(i + 1), FinanceConstants.SCALE, RoundingMode.DOWN));
                System.out.print("\n");
            }
        }
    }
}
