package com.example.phantom.usagelimit;

public class UsageLimitReached extends Exception {
    public UsageLimitReached(String message) {
        super(message);
    }
}
