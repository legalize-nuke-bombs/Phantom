package com.example.phantom.user;

public final class UserConstants {
    public static final int USERNAME_MIN_LENGTH = 4;
    public static final int USERNAME_MAX_LENGTH = 20;
    public static final String USERNAME_PATTERN = "^[a-zA-Z0-9_]+$";

    public static final int DISPLAY_NAME_MIN_LENGTH = 1;
    public static final int DISPLAY_NAME_MAX_LENGTH = 40;

    public static final int PASSWORD_MIN_LENGTH = 8;
    public static final int PASSWORD_MAX_LENGTH = 40;
    public static final String PASSWORD_PATTERN = "^[a-zA-Z\\d@#$%^&+=!]+$";

    public static final int BCRYPT_HASH_LENGTH = 60;

    private UserConstants() {}
}
