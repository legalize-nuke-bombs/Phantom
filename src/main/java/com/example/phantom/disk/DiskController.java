package com.example.phantom.disk;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;


@RestController
@Validated
@RequestMapping("/api/disk")
public class DiskController {

    private final DiskService diskService;

    public DiskController(DiskService diskService) {
        this.diskService = diskService;
    }

    @GetMapping("/settings")
    public DiskSettings getSettings() {
        return diskService.getSettings();
    }

    @GetMapping("/favourites")
    public List<FileRepresentation> getFavourites(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") Integer limit
    ) {
        return diskService.getFavourites(userId, before, limit);
    }

    @GetMapping("/files")
    public List<FileRepresentation> getFiles(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") Integer limit
    ) {
        return diskService.getFiles(userId, before, limit);
    }
}
