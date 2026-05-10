package com.example.phantom.ratelimit;

public class RateLimitReachedRuntime extends RuntimeException {
    public RateLimitReachedRuntime(String action, long retryIn) {
        super("too many requests for '" + action + "', try again in " + retryIn + " seconds");
    }
}
