package com.example.phantom.user;

public enum Role {
    USER,
    CHAT_MODERATOR,
    OWNER;

    public boolean chatModeratorAccess() {
        return this.equals(CHAT_MODERATOR) || this.equals(OWNER);
    }
}
