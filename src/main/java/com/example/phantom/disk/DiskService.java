package com.example.phantom.disk;

import com.example.phantom.disk.favourite.FavouriteFileRepository;
import com.example.phantom.disk.fs.DiskFSService;
import com.example.phantom.disk.usage.DiskUsageService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.LevelFeature;
import com.example.phantom.experience.LevelFeatureService;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DiskService {

    private final UserRepository userRepository;
    private final LevelFeatureService levelFeatureService;
    private final FileRepository fileRepository;
    private final UsageLimitService usageLimitService;
    private final DiskFSService diskFilesystemService;
    private final DiskSettings diskSettings;
    private final DiskUsageService diskStatService;
    private final ProfileService profileService;

    public DiskService(UserRepository userRepository, LevelFeatureService levelFeatureService, FileRepository fileRepository, UsageLimitService usageLimitService, DiskFSService diskFilesystemService, DiskSettings diskSettings, DiskUsageService diskStatService, ProfileService profileService) {
        this.userRepository = userRepository;
        this.levelFeatureService = levelFeatureService;
        this.fileRepository = fileRepository;
        this.usageLimitService = usageLimitService;
        this.diskFilesystemService = diskFilesystemService;
        this.diskSettings = diskSettings;
        this.diskStatService = diskStatService;
        this.profileService = profileService;
    }

    public DiskSettings getSettings() {
        return diskSettings;
    }

    public List<FileRepresentation> getFiles(Long userId, Long before, Integer limit) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);
        List<File> files = fileRepository.findAllWithUsers(userId, before, pageable);

        List<User> users = files.stream().map(File::getUser).toList();
        Map<Long, ProfileCardRepresentation> profileCardMap = profileService.getCardsForUsers(userId, users);

        return files.stream().map(f -> new FileRepresentation(f, profileCardMap.get(f.getUser().getId()))).toList();
    }

    @Transactional
    public FileRepresentation upload(Long userId, MultipartFile multipart) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
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
        diskStatService.reserve(user, rule, new DiskQuota(size, 1));

        File file = new File();
        file.setId(UUID.randomUUID());
        file.setTimestamp(Instant.now().getEpochSecond());
        file.setUser(user);
        file.setOriginalName(name);
        file.setSize(size);
        fileRepository.save(file);

        try {
            diskFilesystemService.store(file.getId(), multipart);
        }
        catch (IOException e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }

        return new FileRepresentation(file, profileService.getCardForUser(userId, user));
    }

    public Download download(Long userId, UUID fileId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        File file = fileRepository.findById(fileId).orElseThrow(() -> new ApiException(ErrorCode.FILE_NOT_FOUND));
        Resource resource = diskFilesystemService.load(file.getId());
        if (!resource.exists()) {
            throw new ApiException(ErrorCode.FILE_NOT_FOUND);
        }
        return new Download(file.getOriginalName(), file.getSize(), resource);
    }

    @Transactional
    public void delete(Long userId, UUID fileId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        File file = fileRepository.findById(fileId).orElseThrow(() -> new ApiException(ErrorCode.FILE_NOT_FOUND));
        if (!file.getUser().getId().equals(userId)) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        long size = file.getSize();
        fileRepository.delete(file);
        diskStatService.release(user, new DiskQuota(size, 1));
        try {
            diskFilesystemService.delete(file.getId());
        }
        catch (IOException ignored) {
        }
    }

    public record Download(String name, long size, Resource resource) {}
}
