package com.example.phantom.wallet;

import java.math.BigDecimal;

public record CryptoWalletRepresentation(
        String address,
        BigDecimal token,
        BigDecimal nativeToken
) {}
