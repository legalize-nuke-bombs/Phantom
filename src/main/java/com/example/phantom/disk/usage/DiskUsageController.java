package com.example.phantom.disk.usage;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/disk/usage")
public class DiskUsageController {

    private final DiskUsageService diskStatService;

    public DiskUsageController(DiskUsageService diskStatService) {
        this.diskStatService = diskStatService;
    }
}
