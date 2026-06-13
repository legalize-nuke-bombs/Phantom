package com.example.phantom.disk.cleaner;

import com.example.phantom.disk.DiskFilesystemService;
import com.example.phantom.disk.FileRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class DiskCleanerService {

    private final FileRepository fileRepository;
    private final DiskFilesystemService diskFilesystemService;

    public DiskCleanerService(FileRepository fileRepository, DiskFilesystemService diskFilesystemService) {
        this.fileRepository = fileRepository;
        this.diskFilesystemService = diskFilesystemService;
    }

    @Scheduled(fixedDelay = 1L * 24 * 60 * 60 * 1000)
    public void clean() {
        log.info("starting cleaning...");

        log.info("cleaning finished");
    }
}
