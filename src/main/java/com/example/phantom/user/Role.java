package com.example.phantom.user;

import lombok.Getter;

@Getter
public enum Role {
    USER(false, false),
    CHAT_MODERATOR(true, false),
    OWNER(true, true);

    final Boolean chatModeratorAccess;
    final Boolean ownerAccess;

    Role(boolean chatModeratorAccess, boolean ownerAccess) {
        this.chatModeratorAccess = chatModeratorAccess;
        this.ownerAccess = ownerAccess;
    }
}
