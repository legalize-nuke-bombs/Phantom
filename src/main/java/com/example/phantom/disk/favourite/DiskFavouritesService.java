package com.example.phantom.disk.favourite;

import com.example.phantom.disk.File;
import com.example.phantom.disk.FileRepository;
import com.example.phantom.disk.FileIdRequest;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class DiskFavouritesService {

    private final UserRepository userRepository;
    private final FileRepository fileRepository;
    private final FavouriteFileRepository favouriteFileRepository;
    private final ProfileService profileService;

    public DiskFavouritesService(UserRepository userRepository, FileRepository fileRepository, FavouriteFileRepository favouriteFileRepository, ProfileService profileService) {
        this.userRepository = userRepository;
        this.fileRepository = fileRepository;
        this.favouriteFileRepository = favouriteFileRepository;
        this.profileService = profileService;
    }

    public List<FavouriteFileRepresentation> get(Long userId, Long before, Integer limit) {
        Pageable pageable = PageRequest.of(0, limit);
        List<FavouriteFile> favouriteFiles = favouriteFileRepository.findAllWithFileAndFileUsers(userId, before, pageable);

        List<User> users = favouriteFiles.stream().map(FavouriteFile::getFile).map(File::getUser).toList();
        Map<Long, ProfileCardRepresentation> profileCardMap = profileService.getCardsForUsers(userId, users);

        return favouriteFiles.stream().map(f -> new FavouriteFileRepresentation(f, profileCardMap.get(f.getFile().getUser().getId()))).toList();
    }

    @Transactional
    public void post(Long userId, FileIdRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        File file = fileRepository.findById(request.getId()).orElseThrow(() -> new ApiException(ErrorCode.FILE_NOT_FOUND));

        try {
            FavouriteFile favouriteFile = new FavouriteFile();
            favouriteFile.setTimestamp(Instant.now().getEpochSecond());
            favouriteFile.setUser(user);
            favouriteFile.setFile(file);
            favouriteFileRepository.save(favouriteFile);
        }
        catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.FILE_ALREADY_IN_FAVOURITES);
        }
    }

    @Transactional
    public void delete(Long userId, FileIdRequest request) {
        favouriteFileRepository.deleteByUserIdFileId(userId, request.getId());
    }
}
