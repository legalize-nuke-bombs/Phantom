package com.example.phantom.disk.usage;

import com.example.phantom.disk.FileRepository;
import com.example.phantom.disk.favourite.FavouriteFileRepository;
import org.springframework.stereotype.Service;

@Service
public class DiskUsageService {

    private final FileRepository fileRepository;
    private final FavouriteFileRepository favouriteFileRepository;

    public DiskUsageService(FileRepository fileRepository, FavouriteFileRepository favouriteFileRepository) {
        this.fileRepository = fileRepository;
        this.favouriteFileRepository = favouriteFileRepository;
    }
}
