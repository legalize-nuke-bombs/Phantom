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

    private final static int CACHE_DURATION = 30;

    private record TickerResponse(String symbol, String price) {}
    private record CachedPrice(BigDecimal price, Long timestamp) {}

    public CryptoExchangeService() {
        this.client = RestClient.builder()
                .baseUrl("https://api.binance.com")
                .build();
        this.cache = new ConcurrentHashMap<>();
    }

    public BigDecimal getTonUsdt() throws CryptoException {
        return getPrice("TONUSDT");
    }

    private BigDecimal getPrice(String symbol) throws CryptoException {
        Long now = Instant.now().getEpochSecond();

        CachedPrice cachedPrice = cache.get(symbol);
        if (cachedPrice != null && now - cachedPrice.timestamp() < CACHE_DURATION) {
            return cachedPrice.price;
        }

        TickerResponse response = client.get()
                .uri("/api/v3/ticker/price?symbol={s}", symbol)
                .retrieve()
                .body(TickerResponse.class);

        if (response == null || response.price() == null) {
            throw new CryptoException("failed to get price for " + symbol);
        }

        BigDecimal price = new BigDecimal(response.price());

        cache.put(symbol, new CachedPrice(price, now));

        return price;
    }
}