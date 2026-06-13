package com.example.phantom.disk;

import com.example.phantom.profile.ProfileCardRepresentation;
import lombok.Getter;

import java.util.UUID;

@Getter
public class FileRepresentation {
    private final UUID id;
    private final Long timestamp;
    private final ProfileCardRepresentation profileCard;
    private final String name;
    private final Long size;

    public FileRepresentation(File file, ProfileCardRepresentation profileCard) {
        this.id = file.getId();
        this.timestamp = file.getTimestamp();
        this.profileCard = profileCard;
        this.name = file.getOriginalName();
        this.size = file.getSize();
    }
}
