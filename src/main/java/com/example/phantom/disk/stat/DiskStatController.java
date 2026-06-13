package com.example.phantom.disk.stat;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/disk/stats")
public class DiskStatController {

    private final DiskStatService diskStatService;

    public DiskStatController(DiskStatService diskStatService) {
        this.diskStatService = diskStatService;
    }
}
