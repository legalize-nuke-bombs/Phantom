package com.example.phantom.disk;

import com.example.phantom.profile.ProfileCardRepresentation;
import lombok.Getter;

@Getter
public class FileRepresentation {
    private final Long timestamp;
    private final ProfileCardRepresentation profileCard;
    private final Boolean visible;
    private final String name;
    private final Long size;

    public FileRepresentation(File file, ProfileCardRepresentation profileCard) {
        this.timestamp = file.getTimestamp();
        this.profileCard = profileCard;
        this.visible = file.getVisible();
        this.name = file.getOriginalName();
        this.size = file.getSize();
    }
}
