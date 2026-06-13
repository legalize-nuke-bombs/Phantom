package com.example.phantom.disk.fs;

import com.example.phantom.disk.FileRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class DiskFSService {
    private final FileRepository fileRepository;

    public DiskFSService(FileRepository fileRepository) {
        this.fileRepository = fileRepository;
    }

    @Scheduled(fixedDelay = 1L * 24 * 60 * 60 * 1000)
    public void clean() {
        log.info("starting cleaning...");

        log.info("cleaning finished");
    }
}
