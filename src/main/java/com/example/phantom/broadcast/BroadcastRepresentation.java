package com.example.phantom.broadcast;

import com.example.phantom.user.User;
import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

@Getter
public class BroadcastRepresentation {
    private final UserShortRepresentation user;
    private final String content;

    public BroadcastRepresentation(User user, String content) {
        this.user = new UserShortRepresentation(user);
        this.content = content;
    }
}
