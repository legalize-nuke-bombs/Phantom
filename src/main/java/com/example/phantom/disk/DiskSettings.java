package com.example.phantom.disk;

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
            @Value("${disk.usage.base.size-mb}") Long baseSizeMb,
            @Value("${disk.usage.base.files}") Long baseFiles,
            @Value("${disk.usage.plus.size-mb}") Long plusSizeMb,
            @Value("${disk.usage.plus.files}") Long plusFiles) {
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
