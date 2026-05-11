package com.example.phantom.config;

import com.example.phantom.usagelimit.UsageLimitRule;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.Plan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class UsageLimiterConfig {
    @Bean
    public UsageLimiter usageLimiter() {
        UsageLimiter usageLimiter = new UsageLimiter();

        usageLimiter.registerRules("pagination", Map.of(
                Plan.DEFAULT, new UsageLimitRule(20L * 50, 60L),
                Plan.PRO, new UsageLimitRule(20L * 100, 60L),
                Plan.MAX, new UsageLimitRule(20L * 200, 60L)
        ));

        usageLimiter.registerRules("crypto", Map.of(
                Plan.DEFAULT, new UsageLimitRule(5L, 60L),
                Plan.PRO, new UsageLimitRule(10L, 60L),
                Plan.MAX, new UsageLimitRule(20L, 60L)
        ));

        return usageLimiter;
    }
}