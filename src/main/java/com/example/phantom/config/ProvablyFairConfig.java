package com.example.phantom.config;

import com.example.phantom.game.util.ProvablyFairProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ProvablyFairConfig {
    @Bean
    public ProvablyFairProvider provablyFairProvider() {
        return new ProvablyFairProvider();
    }
}
