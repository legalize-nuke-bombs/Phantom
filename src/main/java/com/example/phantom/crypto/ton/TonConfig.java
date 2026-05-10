package com.example.phantom.crypto.ton;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import org.ton.ton4j.toncenter.TonCenter;
import org.ton.ton4j.toncenter.Network;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.time.Duration;

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

    @Bean("tonCenterV3Client")
    public RestClient tonCenterV3Client() {
        String baseUrl = testnet ? "https://testnet.toncenter.com/api/v3" : "https://toncenter.com/api/v3";
        return RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("X-API-Key", apiKey)
                .requestFactory(new SimpleClientHttpRequestFactory() {{
                    setConnectTimeout(Duration.ofSeconds(10));
                    setReadTimeout(Duration.ofSeconds(30));
                }})
                .build();
    }
}