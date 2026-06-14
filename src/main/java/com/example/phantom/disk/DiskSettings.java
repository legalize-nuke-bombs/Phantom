package com.example.phantom.disk;

import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
public class DiskSettings {
    private final DiskQuota baseRule;
    private final DiskQuota extendedRule;

    public DiskSettings() {
        this.baseRule = new DiskQuota(
                100L * 1024 * 1024,
                1000
        );
        this.extendedRule = new DiskQuota(
                1L * 1024 * 1024 * 1024,
                10000
        );
    }
}
