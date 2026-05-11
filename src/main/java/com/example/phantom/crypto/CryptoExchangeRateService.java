package com.example.phantom.crypto;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class CryptoExchangeRateService {

    private final RestClient client;
    private final Map<String, CachedPrice> cache;

    private static final int CACHE_DURATION = 30;

    private record CachedPrice(BigDecimal price, long timestamp) {}

    public CryptoExchangeRateService() {
        this.client = RestClient.builder()
                .baseUrl("https://api.coingecko.com")
                .requestFactory(new SimpleClientHttpRequestFactory() {{
                    setConnectTimeout(Duration.ofSeconds(10));
                    setReadTimeout(Duration.ofSeconds(10));
                }})
                .build();
        this.cache = new ConcurrentHashMap<>();
    }

    public BigDecimal getTonUsdt() throws CryptoException {
        return getPrice("the-open-network");
    }

    @SuppressWarnings("unchecked")
    private BigDecimal getPrice(String coinId) throws CryptoException {
        long now = Instant.now().getEpochSecond();

        try {
            return cache.compute(coinId, (key, cached) -> {
                if (cached != null && now - cached.timestamp() < CACHE_DURATION) {
                    return cached;
                }

                log.info("fetching price for {}...", coinId);

                Map<String, Map<String, Number>> response = client.get()
                        .uri("/api/v3/simple/price?ids={id}&vs_currencies=usd", coinId)
                        .retrieve()
                        .body(Map.class);

                if (response == null || !response.containsKey(coinId) || !response.get(coinId).containsKey("usd")) {
                    throw new RuntimeException("failed to get price for " + coinId);
                }

                BigDecimal price = new BigDecimal(response.get(coinId).get("usd").toString());

                log.info("fetched price for {}: {}", coinId, price);
                return new CachedPrice(price, now);
            }).price();
        }
        catch (Exception e) {
            log.error("failed to fetch price for {}", coinId);
            throw new CryptoException(e.getMessage());
        }
    }
}