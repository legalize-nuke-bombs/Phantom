package com.example.phantom.notification;

public final class WsDestinations {

    public static final String TOPIC_PREFIX = "/topic/";
    public static final String USERS_PREFIX = "/topic/users/";

    private WsDestinations() {
    }

    public static String user(long userId) {
        return USERS_PREFIX + userId;
    }

    public static String topic(String id) {
        return TOPIC_PREFIX + id;
    }
}
