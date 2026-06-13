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
                25L * 1024 * 1024,
                250
        );
        this.extendedRule = new DiskQuota(
                100L * 1024 * 1024,
                1000
        );
    }
}
