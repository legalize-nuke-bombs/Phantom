package com.example.phantom.config;

import com.example.phantom.ratelimit.RateLimitFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RateLimitFilterConfig {
    @Bean
    public RateLimitFilter globalRateLimitFilter() {
        return new RateLimitFilter();
    }

    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setOrder(-200);
        return registration;
    }
}