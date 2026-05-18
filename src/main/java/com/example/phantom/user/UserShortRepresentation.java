package com.example.phantom.user;

import lombok.Getter;

@Getter
public class UserShortRepresentation {
    private final Long id;
    private final String displayName;
    private final Role role;

    public UserShortRepresentation(User user) {
        this.id = user.getId();
        this.displayName = user.getDisplayName();
        this.role = user.getRole();
    }
}