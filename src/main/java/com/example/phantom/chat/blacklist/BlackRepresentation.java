package com.example.phantom.chat.blacklist;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

@Getter
public class BlackRepresentation {
    private final Long id;
    private final UserShortRepresentation author;
    private final UserShortRepresentation target;
    private final Long timestamp;

    public BlackRepresentation(Black black) {
        this.id = black.getId();
        this.author = new UserShortRepresentation(black.getAuthor());
        this.target = new UserShortRepresentation(black.getTarget());
        this.timestamp = black.getTimestamp();
    }
}
