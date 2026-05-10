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

    private record TickerResponse(String symbol, String price) {}
    private record CachedPrice(BigDecimal price, long timestamp) {}

    public CryptoExchangeRateService() {
        this.client = RestClient.builder()
                .baseUrl("https://api.binance.com")
                .requestFactory(new SimpleClientHttpRequestFactory() {{
                    setConnectTimeout(Duration.ofSeconds(10));
                    setReadTimeout(Duration.ofSeconds(30));
                }})
                .build();
        this.cache = new ConcurrentHashMap<>();
    }

    public BigDecimal getTonUsdt() throws CryptoException {
        return getPrice("TONUSDT");
    }

    private BigDecimal getPrice(String symbol) throws CryptoException {
        long now = Instant.now().getEpochSecond();

        try {
            return cache.compute(symbol, (key, cached) -> {
                if (cached != null && now - cached.timestamp() < CACHE_DURATION) {
                    return cached;
                }

                log.info("fetching price for {}...", symbol);
                TickerResponse response = client.get().uri("/api/v3/ticker/price?symbol={s}", symbol).retrieve().body(TickerResponse.class);

                if (response == null || response.price() == null) {
                    log.error("failed to fetch price for {}", symbol);
                    throw new RuntimeException("failed to get price for " + symbol);
                }

                String price = response.price;

                log.info("fetched price for {}: {}", symbol, price);
                return new CachedPrice(new BigDecimal(price), now);
            }).price();
        }
        catch (Exception e) {
            throw new CryptoException(e.getMessage());
        }
    }
}