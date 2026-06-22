package com.example.phantom.disk.cleaner;

import com.example.phantom.disk.FileRepository;
import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Slf4j
public class DiskCleanerService {

    private final FileRepository fileRepository;

    private final String root;

    public DiskCleanerService(FileRepository fileRepository, @Value("${disk.root}") @NotNull String root) {
        this.fileRepository = fileRepository;
        this.root = root;
        log.info("initialization, disk root {}", this.root);
    }

    @Scheduled(fixedDelay = 8L * 3600 * 1000)
    public void clean() {
        log.info("starting cleaning...");
        Path rootPath = Path.of(root);
        if (!Files.isDirectory(rootPath)) {
            log.info("cleaning stopped: disk root does not exist");
            return;
        }

        AtomicLong removed = new AtomicLong();
        AtomicLong total = new AtomicLong();
        try (var stream = Files.walk(rootPath)) {
            stream.filter(Files::isRegularFile).forEach(path -> {
                total.incrementAndGet();
                UUID id;
                try {
                    id = UUID.fromString(path.getFileName().toString());
                }
                catch (IllegalArgumentException e) {
                    log.warn("cleaning found invalid path: {}", path);
                    return;
                }
                if (!fileRepository.existsById(id)) {
                    try {
                        Files.deleteIfExists(path);
                        removed.incrementAndGet();
                    }
                    catch (IOException e) {
                        log.warn("cleaning could not delete {}", path);
                    }
                }
            });
        }
        catch (IOException e) {
            log.error("cleaning failed", e);
            return;
        }

        log.info("cleaning finished, removed {} / {} files", removed.get(), total.get());
    }
}
