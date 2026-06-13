package com.example.phantom.user;

import lombok.Getter;

@Getter
public class RoleRepresentation {
    private final String name;
    private final Boolean chatModeratorAccess;
    private final Boolean ownerAccess;

    public RoleRepresentation(Role role) {
        this.name = role.name();
        this.chatModeratorAccess = role.getChatModeratorAccess();
        this.ownerAccess = role.getOwnerAccess();
    }
}
