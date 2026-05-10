package com.example.phantom.config;

import com.example.phantom.ratelimit.Rule;
import com.example.phantom.ratelimit.RateLimiter;
import com.example.phantom.user.Plan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class RateLimiterConfig {
    @Bean
    public RateLimiter rateLimiter() {
        RateLimiter rateLimiter = new RateLimiter();

        rateLimiter.registerRules("pagination", Map.of(
                Plan.DEFAULT, new Rule(20L * 50, 60L),
                Plan.PRO, new Rule(20L * 100, 60L),
                Plan.MAX, new Rule(20L * 200, 60L)
        ));

        rateLimiter.registerRules("crypto", Map.of(
                Plan.DEFAULT, new Rule(5L, 60L),
                Plan.PRO, new Rule(10L, 60L),
                Plan.MAX, new Rule(20L, 60L)
        ));

        return rateLimiter;
    }
}