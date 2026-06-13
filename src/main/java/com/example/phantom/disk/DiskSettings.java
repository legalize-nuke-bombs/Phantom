package com.example.phantom.disk;

import com.example.phantom.user.Plan;
import lombok.Getter;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;
import java.util.TreeMap;

@Component
@Getter
public class DiskSettings {
    private final Map<Long, DiskRule> experienceRules;
    private final Map<Plan, DiskRule> planRules;

    public DiskSettings() {
        this.experienceRules = new TreeMap<>();

        this.experienceRules.put(500L, new DiskRule(
                100L * 1024 * 1024,
                1000,
                2000
        ));
        this.experienceRules.put(2500L, new DiskRule(
                1L * 1024 * 1024 * 1024,
                10000,
                20000
        ));


        this.planRules = new EnumMap<>(Plan.class);

        this.planRules.put(Plan.PRO, new DiskRule(
                10L * 1024 * 1024 * 1024,
                10000,
                20000
        ));

        this.planRules.put(Plan.MAX, new DiskRule(
                100L * 1024 * 1024 * 1024,
                100000,
                200000
        ));

    }
}
