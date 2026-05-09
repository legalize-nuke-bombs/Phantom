package com.example.phantom.ratelimit;

public class RateLimitReached extends Exception {
    public RateLimitReached(String message) {
        super(message);
    }
}
