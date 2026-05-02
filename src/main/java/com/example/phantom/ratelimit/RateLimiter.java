package com.example.phantom.ratelimit;

import com.example.phantom.exception.TooManyRequestsException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimiter {

    private final Map<String, Long> lastRequestTime = new ConcurrentHashMap<>();

    public void check(Long userId, String action, long cooldownMs) {
        String key = userId + ":" + action;
        long now = System.currentTimeMillis();

        lastRequestTime.compute(key, (k, last) -> {
            if (last != null && now - last < cooldownMs) {
                throw new TooManyRequestsException("too many requests, try again later");
            }
            return now;
        });
    }

    @Scheduled(fixedRate = 60000)
    public void cleanup() {
        long now = System.currentTimeMillis();
        lastRequestTime.entrySet().removeIf(e -> now - e.getValue() > 60000);
    }

}