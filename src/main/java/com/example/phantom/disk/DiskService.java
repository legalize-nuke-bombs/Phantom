package com.example.phantom.disk;

import com.example.phantom.disk.fs.DiskFSService;
import com.example.phantom.disk.image.ImageCompressionService;
import com.example.phantom.disk.registry.DiskRegistryService;
import com.example.phantom.disk.usage.DiskUsageService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.LevelFeature;
import com.example.phantom.experience.LevelFeatureService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class DiskService {

    private final DiskRegistryService diskRegistryService;
    private final DiskFSService diskFilesystemService;
    private final DiskUsageService diskUsageService;
    private final DiskSettings diskSettings;
    private final LevelFeatureService levelFeatureService;
    private final RateLimitService rateLimitService;
    private final ImageCompressionService imageCompressionService;

    private static final long LOGGER_MIN_FILE_SIZE = 1024 * 1024;

    public DiskService(DiskRegistryService diskRegistryService, DiskFSService diskFilesystemService, DiskUsageService diskUsageService, DiskSettings diskSettings, LevelFeatureService levelFeatureService, RateLimitService rateLimitService, ImageCompressionService imageCompressionService) {
        this.diskRegistryService = diskRegistryService;
        this.diskFilesystemService = diskFilesystemService;
        this.diskUsageService = diskUsageService;
        this.diskSettings = diskSettings;
        this.levelFeatureService = levelFeatureService;
        this.rateLimitService = rateLimitService;
        this.imageCompressionService = imageCompressionService;
    }

    public DiskSettings getSettings() {
        return diskSettings;
    }

    public List<FileRepresentation> getFiles(Long userId, Long before, Integer limit) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);
        return diskRegistryService.getFiles(userId, before, limit);
    }

    public FileRepresentation upload(Long userId, MultipartFile multipart, Boolean useImageCompression) {
        String name = multipart.getOriginalFilename();
        if (name == null || name.isBlank()) {
            name = "file";
        }
        if (name.length() > FileConstants.FILENAME_MAX_LENGTH) {
            throw new ApiException(ErrorCode.FILENAME_TOO_LONG);
        }

        if (multipart.getSize() >= LOGGER_MIN_FILE_SIZE) {
            log.info("user {} is uploading big file ({} bytes)", userId, multipart.getSize());
        }

        boolean tryCompress = Boolean.TRUE.equals(useImageCompression)
                && multipart.getContentType() != null
                && multipart.getContentType().startsWith("image");

        UUID id = UUID.randomUUID();
        long size;
        String storedName = name;
        try {
            ImageCompressionService.Result compressed = null;
            if (tryCompress) {
                try (InputStream in = multipart.getInputStream()) {
                    compressed = imageCompressionService.compress(in);
                }
            }
            if (compressed != null) {
                diskFilesystemService.store(id, compressed.bytes());
                size = compressed.bytes().length;
                storedName = withExtension(name, compressed.extension());
            }
            else {
                diskFilesystemService.store(id, multipart);
                size = multipart.getSize();
            }
        }
        catch (DiskFSService.DiskFSServiceException | IOException e) {
            log.warn("failed to store file {}", multipart, e);
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }

        DiskQuota rule;
        if (levelFeatureService.haveAccess(userId, LevelFeature.DISK_PRO)) {
            rule = diskSettings.getProRule();
        }
        else if (levelFeatureService.haveAccess(userId, LevelFeature.DISK_PLUS)) {
            rule = diskSettings.getPlusRule();
        }
        else {
            rule = diskSettings.getBaseRule();
        }

        try {
            return diskRegistryService.register(userId, id, storedName, size, rule);
        }
        catch (RuntimeException e) {
            diskFilesystemService.deleteQuietly(id);
            throw e;
        }
    }

    private static String withExtension(String name, String extension) {
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        return base + "." + extension;
    }

    public Download download(Long userId, UUID fileId) {
        File file = diskRegistryService.getFile(fileId);
        rateLimitService.startAction(userId, RateLimitAction.DOWNLOAD, file.getSize());

        if (file.getSize() >= LOGGER_MIN_FILE_SIZE) {
            log.info("user {} is downloading big file ({} bytes)", userId, file.getSize());
        }

        Resource resource = diskFilesystemService.load(file.getId());
        if (!resource.exists()) {
            throw new ApiException(ErrorCode.FILE_NOT_FOUND);
        }

        return new Download(file.getOriginalName(), file.getSize(), resource);
    }

    public void delete(Long userId, UUID fileId) {
        diskRegistryService.unregister(userId, fileId);
        diskFilesystemService.deleteQuietly(fileId);
    }

    public DiskQuota getPersonalUsage(Long userId) {
        return diskUsageService.getPersonalUsage(userId);
    }

    public DiskQuota getPlatformUsage() {
        return diskUsageService.getPlatformUsage();
    }

    public record Download(String name, long size, Resource resource) {}
}
