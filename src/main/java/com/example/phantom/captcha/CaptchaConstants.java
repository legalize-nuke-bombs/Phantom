package com.example.phantom.captcha;

public final class CaptchaConstants {
    public static final int CODE_LENGTH = 5;
    public static final long TTL_MS = 60L * 1000;
    public static final int WIDTH = 220;
    public static final int HEIGHT = 80;
    public static final int ANSWER_MAX_LENGTH = 16;
    public static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    private CaptchaConstants() {}
}
