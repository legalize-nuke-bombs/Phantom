package com.example.phantom.disk;

import com.example.phantom.disk.favourite.DiskFavouritesService;
import com.example.phantom.disk.favourite.FavouriteFileRepresentation;
import com.example.phantom.disk.fs.DiskFSService;
import com.example.phantom.disk.registry.DiskRegistryService;
import com.example.phantom.disk.usage.DiskUsageService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.LevelFeature;
import com.example.phantom.experience.LevelFeatureService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
public class DiskService {

    private final DiskRegistryService diskRegistryService;
    private final DiskFSService diskFilesystemService;
    private final DiskFavouritesService diskFavouritesService;
    private final DiskUsageService diskUsageService;
    private final DiskSettings diskSettings;
    private final LevelFeatureService levelFeatureService;
    private final RateLimitService rateLimitService;

    public DiskService(DiskRegistryService diskRegistryService, DiskFSService diskFilesystemService, DiskFavouritesService diskFavouritesService, DiskUsageService diskUsageService, DiskSettings diskSettings, LevelFeatureService levelFeatureService, RateLimitService rateLimitService) {
        this.diskRegistryService = diskRegistryService;
        this.diskFilesystemService = diskFilesystemService;
        this.diskFavouritesService = diskFavouritesService;
        this.diskUsageService = diskUsageService;
        this.diskSettings = diskSettings;
        this.levelFeatureService = levelFeatureService;
        this.rateLimitService = rateLimitService;
    }

    public DiskSettings getSettings() {
        return diskSettings;
    }

    public List<FileRepresentation> getFiles(Long userId, Long before, Integer limit) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);
        return diskRegistryService.getFiles(userId, before, limit);
    }

    public FileRepresentation upload(Long userId, MultipartFile multipart) {
        levelFeatureService.validateAccess(userId, LevelFeature.DISK_BASE);

        String name = multipart.getOriginalFilename();
        if (name == null || name.isBlank()) {
            name = "file";
        }
        if (name.length() > FileConstants.FILENAME_MAX_LENGTH) {
            throw new ApiException(ErrorCode.FILENAME_TOO_LONG);
        }

        DiskQuota rule = levelFeatureService.haveAccess(userId, LevelFeature.DISK_ADVANCED)
                ? diskSettings.getExtendedRule()
                : diskSettings.getBaseRule();

        long size = multipart.getSize();
        rateLimitService.startAction(userId, RateLimitAction.UPLOAD, size);

        UUID id = UUID.randomUUID();

        try {
            diskFilesystemService.store(id, multipart);
        }
        catch (IOException e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }

        try {
            return diskRegistryService.register(userId, id, name, size, rule);
        }
        catch (RuntimeException e) {
            diskFilesystemService.deleteQuietly(id);
            throw e;
        }
    }

    public Download download(Long userId, UUID fileId) {
        levelFeatureService.validateAccess(userId, LevelFeature.DISK_BASE);

        File file = diskRegistryService.getFile(fileId);
        rateLimitService.startAction(userId, RateLimitAction.DOWNLOAD, file.getSize());

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

    public List<FavouriteFileRepresentation> getFavourites(Long userId, Long before, Integer limit) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);
        return diskFavouritesService.get(userId, before, limit);
    }

    public void addFavourite(Long userId, FileIdRequest request) {
        diskFavouritesService.post(userId, request);
    }

    public void removeFavourite(Long userId, FileIdRequest request) {
        diskFavouritesService.delete(userId, request);
    }

    public DiskQuota getPersonalUsage(Long userId) {
        return diskUsageService.getPersonalUsage(userId);
    }

    public DiskQuota getPlatformUsage() {
        return diskUsageService.getPlatformUsage();
    }

    public record Download(String name, long size, Resource resource) {}
}
