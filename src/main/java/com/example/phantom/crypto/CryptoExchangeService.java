package com.example.phantom.crypto;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CryptoExchangeService {

    private final RestClient client;
    private final Map<String, CachedPrice> cache;

    private static final int CACHE_DURATION = 30;

    private record TickerResponse(String symbol, String price) {}
    private record CachedPrice(BigDecimal price, long timestamp) {}

    public CryptoExchangeService() {
        this.client = RestClient.builder().baseUrl("https://api.binance.com").build();
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

                TickerResponse response = client.get().uri("/api/v3/ticker/price?symbol={s}", symbol).retrieve().body(TickerResponse.class);

                if (response == null || response.price() == null) {
                    throw new CryptoRuntimeException("failed to get price for " + symbol);
                }

                return new CachedPrice(new BigDecimal(response.price()), now);
            }).price();
        }
        catch (CryptoRuntimeException e) {
            throw new CryptoException(e.getMessage());
        }
    }
}