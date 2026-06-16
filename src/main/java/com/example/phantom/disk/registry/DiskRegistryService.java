package com.example.phantom.disk.registry;

import com.example.phantom.disk.DiskQuota;
import com.example.phantom.disk.File;
import com.example.phantom.disk.FileRepository;
import com.example.phantom.disk.FileRepresentation;
import com.example.phantom.disk.usage.DiskUsageService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DiskRegistryService {

    private final UserRepository userRepository;
    private final FileRepository fileRepository;
    private final DiskUsageService diskUsageService;

    public DiskRegistryService(UserRepository userRepository, FileRepository fileRepository, DiskUsageService diskUsageService) {
        this.userRepository = userRepository;
        this.fileRepository = fileRepository;
        this.diskUsageService = diskUsageService;
    }

    public List<FileRepresentation> getFiles(Long userId, Long before, Integer limit) {
        Pageable pageable = PageRequest.of(0, limit);
        List<File> files = fileRepository.findAllWithUsers(userId, before, pageable);

        return files.stream().map(FileRepresentation::new).toList();
    }

    public File getFile(UUID fileId) {
        return fileRepository.findById(fileId).orElseThrow(() -> new ApiException(ErrorCode.FILE_NOT_FOUND));
    }

    @Transactional
    public FileRepresentation register(Long userId, UUID fileId, String name, long size, DiskQuota rule) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        diskUsageService.reserve(user, rule, new DiskQuota(size, 1));

        File file = new File();
        file.setId(fileId);
        file.setTimestamp(Instant.now().getEpochSecond());
        file.setUser(user);
        file.setOriginalName(name);
        file.setSize(size);
        fileRepository.save(file);

        return new FileRepresentation(file);
    }

    @Transactional
    public void unregister(Long userId, UUID fileId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        File file = fileRepository.findById(fileId).orElseThrow(() -> new ApiException(ErrorCode.FILE_NOT_FOUND));

        if (!file.getUser().getId().equals(userId)) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }

        long size = file.getSize();
        fileRepository.delete(file);
        diskUsageService.release(user, new DiskQuota(size, 1));
    }
}
