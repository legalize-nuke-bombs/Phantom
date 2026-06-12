package com.example.phantom.crypto;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
public class CoinProviderRegistry {

    private final Map<CoinType, CoinProvider> providers;

    public CoinProviderRegistry(List<CoinProvider> providers) {
        this.providers = new EnumMap<>(CoinType.class);
        for (CoinProvider provider : providers) {
            this.providers.put(provider.coin(), provider);
        }
    }

    public CoinProvider get(CoinType coin) {
        CoinProvider provider = providers.get(coin);
        if (provider == null) throw new ApiException(ErrorCode.UNSUPPORTED_COIN);
        return provider;
    }

    public Collection<CoinProvider> getAll() {
        return providers.values();
    }
}
