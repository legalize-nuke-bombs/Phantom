package com.example.phantom.disk;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

import java.util.UUID;

@Getter
public class FileRepresentation {
    private final UUID id;
    private final Long timestamp;
    private final UserShortRepresentation user;
    private final String name;
    private final Long size;

    public FileRepresentation(File file) {
        this.id = file.getId();
        this.timestamp = file.getTimestamp();
        this.user = new UserShortRepresentation(file.getUser());
        this.name = file.getOriginalName();
        this.size = file.getSize();
    }
}
