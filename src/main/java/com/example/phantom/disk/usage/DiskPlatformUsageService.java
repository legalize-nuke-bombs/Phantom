package com.example.phantom.disk.usage;

import com.example.phantom.disk.DiskQuota;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class DiskPlatformUsageService {

    private final DiskUsageRepository diskUsageRepository;
    private volatile DiskQuota platformUsageCache;

    private static final long CACHE_DURATION = 10 * 1000;

    public DiskPlatformUsageService(DiskUsageRepository diskUsageRepository) {
        this.diskUsageRepository = diskUsageRepository;
        this.platformUsageCache = null;
    }

    @Scheduled(fixedDelay = CACHE_DURATION)
    public void updateCache() {
        this.platformUsageCache = new DiskQuota(
                diskUsageRepository.sumSizes(),
                diskUsageRepository.sumFiles()
        );
    }

    public DiskQuota getPlatformUsage() {
        return platformUsageCache;
    }
}
