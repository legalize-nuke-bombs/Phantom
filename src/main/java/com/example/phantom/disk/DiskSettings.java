package com.example.phantom.disk;

import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
public class DiskSettings {
    private final DiskQuota baseRule;
    private final DiskQuota plusRule;
    private final DiskQuota proRule;

    public DiskSettings() {
        this.baseRule = new DiskQuota(
                100L * 1024 * 1024,
                1000
        );
        this.plusRule = new DiskQuota(
                1L * 1024 * 1024 * 1024,
                10000
        );
        this.proRule = new DiskQuota(
                10L * 1024 * 1024 * 1024,
                100000
        );
    }
}
