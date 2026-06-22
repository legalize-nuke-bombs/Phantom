package com.example.phantom.disk;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@Getter
@Slf4j
public class DiskSettings {
    private final DiskQuota baseRule;
    private final DiskQuota plusRule;

    public DiskSettings(@Value("${file.shortenedLimits}") @NotNull Boolean fileShortenedLimits) {
        this.baseRule = buildQuota(
                1L * 1024 * 1024 * 1024,
                10000L,
                fileShortenedLimits
        );
        this.plusRule = buildQuota(
                10L * 1024 * 1024 * 1024,
                100000L,
                fileShortenedLimits
        );
        log.info("initialization, file shortened limits {}", fileShortenedLimits);
    }

    private DiskQuota buildQuota(Long size, Long files, Boolean fileShortenedLimits) {
        if (fileShortenedLimits) {
            return new DiskQuota(
                    size / 20,
                    files / 20
            );
        }
        return new DiskQuota(
                size,
                files
        );
    }
}
