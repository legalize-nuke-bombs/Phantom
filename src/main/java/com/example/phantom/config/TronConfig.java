package com.example.phantom.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.crypto.Bip32ECKeyPair;
import org.web3j.crypto.MnemonicUtils;

@Configuration
public class TronConfig {

    @Bean
    public String tronPrivateKey(@Value("${tron.mnemonic}") String mnemonic) {
        byte[] seed = MnemonicUtils.generateSeed(mnemonic, "");
        Bip32ECKeyPair master = Bip32ECKeyPair.generateKeyPair(seed);
        int[] path = {44 | 0x80000000, 195 | 0x80000000, 0x80000000, 0, 0};
        Bip32ECKeyPair derived = Bip32ECKeyPair.deriveKeyPair(master, path);
        return derived.getPrivateKey().toString(16);
    }
}