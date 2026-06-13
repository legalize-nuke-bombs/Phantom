package com.example.phantom.disk;

import com.example.phantom.disk.favourite.FavouriteFileRepository;
import com.example.phantom.experience.LevelFeatureService;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class DiskService {

    private final UserRepository userRepository;
    private final LevelFeatureService levelFeatureService;
    private final FileRepository fileRepository;
    private final FavouriteFileRepository favouriteFileRepository;
    private final UsageLimitService usageLimitService;
    private final DiskFilesystemService diskFilesystemService;
    private final DiskSettings diskSettings;

    public DiskService(UserRepository userRepository, LevelFeatureService levelFeatureService, FileRepository fileRepository, FavouriteFileRepository favouriteFileRepository, UsageLimitService usageLimitService, DiskFilesystemService diskFilesystemService, DiskSettings diskSettings) {
        this.userRepository = userRepository;
        this.levelFeatureService = levelFeatureService;
        this.fileRepository = fileRepository;
        this.favouriteFileRepository = favouriteFileRepository;
        this.usageLimitService = usageLimitService;
        this.diskFilesystemService = diskFilesystemService;
        this.diskSettings = diskSettings;
    }
}
