package com.example.phantom.ton;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Getter
@Configuration
public class TonConfig {

    @Value("${ton.api.key}")
    private String apiKey;

    @Value("${ton.testnet}")
    private boolean testnet;
}
