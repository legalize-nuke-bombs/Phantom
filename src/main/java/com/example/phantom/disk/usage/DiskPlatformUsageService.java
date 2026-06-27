package com.example.phantom.disk.usage;

import com.example.phantom.disk.DiskQuota;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class DiskPlatformUsageService {

    private final DiskUsageRepository diskUsageRepository;
    private volatile DiskQuota platformUsageCache;

    public DiskPlatformUsageService(DiskUsageRepository diskUsageRepository) {
        this.diskUsageRepository = diskUsageRepository;
        this.platformUsageCache = null;
    }

    @Scheduled(fixedDelay = 60 * 1000)
    public void updateCache() {
        log.debug("updating disk platform usage cache...");
        this.platformUsageCache = new DiskQuota(
                diskUsageRepository.sumSizes(),
                diskUsageRepository.sumFiles()
        );
    }

    public DiskQuota getPlatformUsage() {
        return platformUsageCache;
    }
}
