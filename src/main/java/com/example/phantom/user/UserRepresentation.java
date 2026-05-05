package com.example.phantom.user;

import lombok.Getter;

@Getter
public class UserRepresentation {
    private final Long id;
    private final String username;
    private final String displayName;
    private final Role role;

    public UserRepresentation(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.displayName = user.getDisplayName();
        this.role = user.getRole();
    }
}
