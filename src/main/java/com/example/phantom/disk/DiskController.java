package com.example.phantom.disk;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/disk")
public class DiskController {

    private final DiskService diskService;

    public DiskController(DiskService diskService) {
        this.diskService = diskService;
    }
}
