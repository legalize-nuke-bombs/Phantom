package com.example.phantom.disk.fs;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Service
@Slf4j
public class DiskFSService {

    @Value("${disk.root}")
    private String root;

    public static class DiskFSServiceException extends Exception {
        public DiskFSServiceException(String m) {
            super(m);
        }
    }

    public void store(UUID id, MultipartFile file) throws DiskFSServiceException {
        try {
            Path target = pathFor(id);
            Files.createDirectories(target.getParent());
            file.transferTo(target.toAbsolutePath().toFile());
        }
        catch (Exception e) {
            log.warn("couldn't store multipart file, {}", id, e);
            throw new DiskFSServiceException(e.getMessage());
        }
    }

    public void store(UUID id, byte[] bytes) throws DiskFSServiceException {
        try {
            Path target = pathFor(id);
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        }
        catch (Exception e) {
            log.warn("couldn't store byte file {}", id, e);
            throw new DiskFSServiceException(e.getMessage());
        }
    }

    public Resource load(UUID id) {
        return new FileSystemResource(pathFor(id));
    }

    public void deleteQuietly(UUID id) {
        try {
            Files.deleteIfExists(pathFor(id));
        }
        catch (IOException e) {
            log.warn("could not delete file {}", id, e);
        }
    }

    private Path pathFor(UUID id) {
        String s = id.toString();
        return Path.of(root, s.substring(0, 2), s.substring(2, 4), s);
    }
}
