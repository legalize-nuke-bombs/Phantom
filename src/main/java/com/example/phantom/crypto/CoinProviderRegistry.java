package com.example.phantom.crypto;

import com.example.phantom.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class CoinProviderRegistry {

    private final Map<String, CoinProvider> providers;

    public CoinProviderRegistry(List<CoinProvider> providers) {
        this.providers = providers.stream().collect(Collectors.toMap(CoinProvider::coin, Function.identity()));
    }

    public CoinProvider get(String coin) {
        CoinProvider provider = providers.get(coin);
        if (provider == null) throw new BadRequestException("unsupported coin");
        return provider;
    }

    public Collection<CoinProvider> getAll() {
        return providers.values();
    }
}
