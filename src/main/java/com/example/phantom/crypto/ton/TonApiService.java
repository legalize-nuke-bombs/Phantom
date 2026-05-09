package com.example.phantom.crypto.ton;

import com.iwebpp.crypto.TweetNaclFast;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.ton.ton4j.address.Address;
import org.ton.ton4j.mnemonic.Mnemonic;
import org.ton.ton4j.mnemonic.Pair;
import org.ton.ton4j.smartcontract.wallet.v1.WalletV1R1;
import org.ton.ton4j.smartcontract.wallet.v1.WalletV1R2;
import org.ton.ton4j.smartcontract.wallet.v1.WalletV1R3;
import org.ton.ton4j.smartcontract.wallet.v2.WalletV2R1;
import org.ton.ton4j.smartcontract.wallet.v2.WalletV2R2;
import org.ton.ton4j.smartcontract.wallet.v3.WalletV3R1;
import org.ton.ton4j.smartcontract.wallet.v3.WalletV3R2;
import org.ton.ton4j.smartcontract.wallet.v4.WalletV4R2;
import org.ton.ton4j.smartcontract.wallet.v5.WalletV5;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HexFormat;

@Service
public class TonApiService {

    private static final long WALLET_ID_V3V4 = 698983191L;
    private static final long WALLET_ID_V5 = 2147483409L;
    private static final BigDecimal NANOTON = new BigDecimal("1000000000");

    private final RestClient client;
    private final boolean testnet;

    public record KeyPair(String address, String privateKey) {}
    private record ToncenterResponse(boolean ok, String result) {}

    public TonApiService(@Value("${ton.api.base-url}") String baseUrl,
                         @Value("${ton.api.key:}") String apiKey,
                         @Value("${ton.testnet:false}") boolean testnet) {
        this.testnet = testnet;
        RestClient.Builder builder = RestClient.builder().baseUrl(baseUrl);
        if (apiKey != null && !apiKey.isBlank()) {
            builder.defaultHeader("X-API-Key", apiKey);
        }
        this.client = builder.build();
    }

    public String generateMnemonic() throws TonApiException {
        try { return Mnemonic.generateString(24); }
        catch (Exception e) { throw new TonApiException(e.getMessage()); }
    }

    public KeyPair deriveKeyPair(String mnemonic, TonWalletVersion version) throws TonApiException {
        Pair keys;
        try { keys = Mnemonic.toKeyPair(mnemonic); }
        catch (Exception e) { throw new TonApiException(e.getMessage()); }

        TweetNaclFast.Signature.KeyPair sigKeyPair = TweetNaclFast.Signature.keyPair_fromSeed(keys.getSecretKey());
        Address walletAddress = buildWalletAddress(sigKeyPair, version);
        String address = testnet
                ? walletAddress.toNonBounceableTestnet()
                : walletAddress.toNonBounceable();
        return new KeyPair(address, HexFormat.of().formatHex(keys.getSecretKey()));
    }

    public BigDecimal getBalance(String address) throws TonApiException {
        ToncenterResponse response = client.get()
                .uri("/api/v2/getAddressBalance?address={addr}", address)
                .retrieve()
                .body(ToncenterResponse.class);

        if (response == null || !response.ok()) {
            throw new TonApiException("failed to get balance for " + address);
        }
        return new BigDecimal(response.result()).divide(NANOTON, 9, RoundingMode.DOWN);
    }

    private Address buildWalletAddress(TweetNaclFast.Signature.KeyPair keyPair, TonWalletVersion version) {
        return switch (version) {
            case V1R1 -> WalletV1R1.builder().wc(0).keyPair(keyPair).build().getAddress();
            case V1R2 -> WalletV1R2.builder().wc(0).keyPair(keyPair).build().getAddress();
            case V1R3 -> WalletV1R3.builder().wc(0).keyPair(keyPair).build().getAddress();
            case V2R1 -> WalletV2R1.builder().wc(0).keyPair(keyPair).build().getAddress();
            case V2R2 -> WalletV2R2.builder().wc(0).keyPair(keyPair).build().getAddress();
            case V3R1 -> WalletV3R1.builder().wc(0).keyPair(keyPair).walletId(WALLET_ID_V3V4).build().getAddress();
            case V3R2 -> WalletV3R2.builder().wc(0).keyPair(keyPair).walletId(WALLET_ID_V3V4).build().getAddress();
            case V4R2 -> WalletV4R2.builder().wc(0).keyPair(keyPair).walletId(WALLET_ID_V3V4).build().getAddress();
            case V5 -> WalletV5.builder().wc(0).keyPair(keyPair).walletId(WALLET_ID_V5).isSigAuthAllowed(true).build().getAddress();
        };
    }
}