package com.example.phantom.crypto;

import lombok.Getter;

@Getter
public class CryptoWalletRepresentation {
    private final String coin;
    private final String address;

    public CryptoWalletRepresentation(CryptoWallet wallet) {
        this.coin = wallet.getCoin();
        this.address = wallet.getAddress();
    }
}
