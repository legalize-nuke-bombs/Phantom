package com.example.phantom.disk;

import com.example.phantom.disk.favourite.FavouriteFileRepository;
import com.example.phantom.disk.usage.DiskUsageService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.LevelFeatureService;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class DiskService {

    private final UserRepository userRepository;
    private final LevelFeatureService levelFeatureService;
    private final FileRepository fileRepository;
    private final FavouriteFileRepository favouriteFileRepository;
    private final UsageLimitService usageLimitService;
    private final DiskFilesystemService diskFilesystemService;
    private final DiskSettings diskSettings;
    private final DiskUsageService diskStatService;
    private final ProfileService profileService;

    public DiskService(UserRepository userRepository, LevelFeatureService levelFeatureService, FileRepository fileRepository, FavouriteFileRepository favouriteFileRepository, UsageLimitService usageLimitService, DiskFilesystemService diskFilesystemService, DiskSettings diskSettings, DiskUsageService diskStatService, ProfileService profileService) {
        this.userRepository = userRepository;
        this.levelFeatureService = levelFeatureService;
        this.fileRepository = fileRepository;
        this.favouriteFileRepository = favouriteFileRepository;
        this.usageLimitService = usageLimitService;
        this.diskFilesystemService = diskFilesystemService;
        this.diskSettings = diskSettings;
        this.diskStatService = diskStatService;
        this.profileService = profileService;
    }

    public DiskSettings getSettings() {
        return diskSettings;
    }

    public List<FileRepresentation> getFavourites(Long userId, Long before, Integer limit) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);
        List<File> files = favouriteFileRepository.findFilesWithUsers(userId, before, pageable);

        List<User> users = files.stream().map(File::getUser).toList();
        Map<Long, ProfileCardRepresentation> profileCardMap = profileService.getCardsForUsers(userId, users);

        return files.stream().map(f -> new FileRepresentation(f, profileCardMap.get(f.getUser().getId()))).toList();
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
}
