package com.example.phantom.disk;

import com.example.phantom.disk.favourite.FavouriteFileRepository;
import com.example.phantom.disk.stat.DiskStatService;
import com.example.phantom.experience.LevelFeatureService;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DiskService {

    private final UserRepository userRepository;
    private final LevelFeatureService levelFeatureService;
    private final FileRepository fileRepository;
    private final FavouriteFileRepository favouriteFileRepository;
    private final UsageLimitService usageLimitService;
    private final DiskFilesystemService diskFilesystemService;
    private final DiskSettings diskSettings;
    private final DiskStatService diskStatService;

    public DiskService(UserRepository userRepository, LevelFeatureService levelFeatureService, FileRepository fileRepository, FavouriteFileRepository favouriteFileRepository, UsageLimitService usageLimitService, DiskFilesystemService diskFilesystemService, DiskSettings diskSettings, DiskStatService diskStatService) {
        this.userRepository = userRepository;
        this.levelFeatureService = levelFeatureService;
        this.fileRepository = fileRepository;
        this.favouriteFileRepository = favouriteFileRepository;
        this.usageLimitService = usageLimitService;
        this.diskFilesystemService = diskFilesystemService;
        this.diskSettings = diskSettings;
        this.diskStatService = diskStatService;
    }

    public DiskSettings getSettings() {
        return diskSettings;
    }

    public List<FileRepresentation> getFavourites(Long userId, Long before, Integer limit) {
        return null;
    }

    public List<FileRepresentation> getFiles(Long userId, Long before, Integer limit) {
        return null;
    }
}
