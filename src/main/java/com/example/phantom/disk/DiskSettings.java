package com.example.phantom.disk;

import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
public class DiskSettings {
    private final DiskRule baseRule;
    private final DiskRule extendedRule;

    public DiskSettings() {
        this.baseRule = new DiskRule(
                50L * 1024 * 1024,
                100,
                100
        );
        this.extendedRule = new DiskRule(
                1L * 1024 * 1024 * 1024,
                1000,
                1000
        );
    }
}
