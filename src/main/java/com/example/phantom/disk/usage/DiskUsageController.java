package com.example.phantom.disk.usage;

import com.example.phantom.disk.DiskQuota;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/disk/usage")
public class DiskUsageController {

    private final DiskUsageService diskUsageService;

    public DiskUsageController(DiskUsageService diskUsageService) {
        this.diskUsageService = diskUsageService;
    }

    @GetMapping("/personal")
    public DiskQuota getPersonalUsage(@AuthenticationPrincipal Long userId) {
        return diskUsageService.getPersonalUsage(userId);
    }

    @GetMapping("/platform")
    public DiskQuota getPlatformUsage() {
        return diskUsageService.getPlatformUsage();
    }
}
