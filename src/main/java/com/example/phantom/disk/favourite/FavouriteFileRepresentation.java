package com.example.phantom.disk.favourite;

import com.example.phantom.disk.FileRepresentation;
import com.example.phantom.profile.ProfileCardRepresentation;
import lombok.Getter;

@Getter
public class FavouriteFileRepresentation {
    private final Long timestamp;
    private final FileRepresentation file;

    public FavouriteFileRepresentation(FavouriteFile favouriteFile, ProfileCardRepresentation profileCard) {
        this.timestamp = favouriteFile.getTimestamp();
        this.file = new FileRepresentation(favouriteFile.getFile(), profileCard);
    }
}
