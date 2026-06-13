package com.example.phantom.disk.stat;

import com.example.phantom.disk.FileRepository;
import com.example.phantom.disk.favourite.FavouriteFileRepository;
import org.springframework.stereotype.Service;

@Service
public class DiskStatService {

    private final FileRepository fileRepository;
    private final FavouriteFileRepository favouriteFileRepository;

    public DiskStatService(FileRepository fileRepository, FavouriteFileRepository favouriteFileRepository) {
        this.fileRepository = fileRepository;
        this.favouriteFileRepository = favouriteFileRepository;
    }
}
