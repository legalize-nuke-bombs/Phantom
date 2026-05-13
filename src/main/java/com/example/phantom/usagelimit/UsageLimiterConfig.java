package com.example.phantom.usagelimit;

import com.example.phantom.user.Plan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class UsageLimiterConfig {
    @Bean
    public UsageLimiter usageLimiter() {
        UsageLimiter usageLimiter = new UsageLimiter();

        usageLimiter.registerRules(UsageAction.PAGINATION, Map.of(
                Plan.DEFAULT, new UsageLimitRule(20L * 100, 60L),
                Plan.PRO, new UsageLimitRule(20L * 200, 60L),
                Plan.MAX, new UsageLimitRule(20L * 400, 60L)
        ));

        usageLimiter.registerRules(UsageAction.CRYPTO, Map.of(
                Plan.DEFAULT, new UsageLimitRule(10L, 60L),
                Plan.PRO, new UsageLimitRule(20L, 60L),
                Plan.MAX, new UsageLimitRule(40L, 60L)
        ));

        return usageLimiter;
    }
}