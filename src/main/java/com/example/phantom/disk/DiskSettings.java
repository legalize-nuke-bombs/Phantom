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

    public DiskSettings(
            @Value("${disk.usage.base.size-mb}") @NotNull Long baseSizeMb,
            @Value("${disk.usage.base.files}") @NotNull Long baseFiles,
            @Value("${disk.usage.plus.size-mb}") @NotNull Long plusSizeMb,
            @Value("${disk.usage.plus.files}") @NotNull Long plusFiles) {
        baseRule = new DiskQuota(
                baseSizeMb * 1024 * 1024,
                baseFiles
        );
        plusRule = new DiskQuota(
                plusSizeMb * 1024 * 1024,
                plusFiles
        );
        log.info("initialization, base: size {} files {}, plus: size {} files {}", baseRule.getSize(), baseRule.getFiles(), plusRule.getSize(), plusRule.getFiles());
    }
}
