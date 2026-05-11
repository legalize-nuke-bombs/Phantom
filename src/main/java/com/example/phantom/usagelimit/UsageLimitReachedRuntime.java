package com.example.phantom.usagelimit;

class UsageLimitReachedRuntime extends RuntimeException {
    public UsageLimitReachedRuntime(String action, long retryIn) {
        super("too many requests for '" + action + "', try again in " + retryIn + " seconds");
    }
}
