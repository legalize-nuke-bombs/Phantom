package com.example.phantom.disk.fs;

import com.example.phantom.disk.FileRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@Slf4j
public class DiskFSService {
    private final FileRepository fileRepository;

    @Value("${disk.root}")
    private String root;

    public DiskFSService(FileRepository fileRepository) {
        this.fileRepository = fileRepository;
    }

    public void store(UUID id, MultipartFile file) throws IOException {
        Path target = pathFor(id);
        Files.createDirectories(target.getParent());
        try (var in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public Resource load(UUID id) {
        return new FileSystemResource(pathFor(id));
    }

    public void delete(UUID id) throws IOException {
        Files.deleteIfExists(pathFor(id));
    }

    private Path pathFor(UUID id) {
        String s = id.toString();
        return Path.of(root, s.substring(0, 2), s.substring(2, 4), s);
    }

    @Scheduled(fixedDelay = 1L * 24 * 60 * 60 * 1000)
    public void clean() {
        log.info("starting cleaning...");
        Path rootPath = Path.of(root);
        if (!Files.isDirectory(rootPath)) {
            log.info("cleaning stopped: disk root does not exist");
            return;
        }

        AtomicInteger removed = new AtomicInteger();
        try (var stream = Files.walk(rootPath)) {
            stream.filter(Files::isRegularFile).forEach(path -> {
                UUID id;
                try {
                    id = UUID.fromString(path.getFileName().toString());
                }
                catch (IllegalArgumentException e) {
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

        log.info("cleaning finished, removed {} files", removed.get());
    }
}
