package com.example.phantom.crypto.ton;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.ton.ton4j.toncenter.TonCenter;
import org.ton.ton4j.toncenter.Network;

@Getter
@Configuration
public class TonConfig {

    @Value("${ton.api.key}")
    private String apiKey;

    @Value("${ton.testnet}")
    private boolean testnet;

    @Bean(destroyMethod = "close")
    public TonCenter tonCenter() {
        return TonCenter.builder().apiKey(apiKey).network(testnet ? Network.TESTNET : Network.MAINNET).build();
    }
}