package com.example.phantom.disk.usage;

import com.example.phantom.disk.DiskQuota;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DiskUsageService {

    private final DiskUsageRepository diskUsageRepository;
    private final DiskPlatformUsageService diskPlatformUsageService;

    public DiskUsageService(DiskUsageRepository diskUsageRepository, DiskPlatformUsageService diskPlatformUsageService) {
        this.diskUsageRepository = diskUsageRepository;
        this.diskPlatformUsageService = diskPlatformUsageService;
    }

    public DiskQuota getPersonalUsage(Long userId) {
        DiskUsage diskUsage = diskUsageRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.DISK_USAGE_NOT_FOUND));

        return new DiskQuota(diskUsage.getSize(), diskUsage.getFiles());
    }

    public DiskQuota getPlatformUsage() {
        return diskPlatformUsageService.getPlatformUsage();
    }

    @Transactional
    public void reserve(User user, DiskQuota rule, DiskQuota change) {
        DiskUsage diskUsage = diskUsageRepository.findByIdForPessimisticWrite(user.getId()).orElseThrow(() -> new ApiException(ErrorCode.DISK_USAGE_NOT_FOUND));

        diskUsage.setSize(diskUsage.getSize() + change.getSize());
        diskUsage.setFiles(diskUsage.getFiles() + change.getFiles());

        if (diskUsage.getSize() > rule.getSize() || diskUsage.getFiles() > rule.getFiles()) {
            throw new ApiException(ErrorCode.DISK_QUOTA_EXCEEDED);
        }

        diskUsageRepository.save(diskUsage);
    }

    @Transactional
    public void release(User user, DiskQuota change) {
        DiskUsage diskUsage = diskUsageRepository.findByIdForPessimisticWrite(user.getId()).orElseThrow(() -> new ApiException(ErrorCode.DISK_USAGE_NOT_FOUND));

        diskUsage.setSize(diskUsage.getSize() - change.getSize());
        diskUsage.setFiles(diskUsage.getFiles() - change.getFiles());

        diskUsageRepository.save(diskUsage);
    }
}
