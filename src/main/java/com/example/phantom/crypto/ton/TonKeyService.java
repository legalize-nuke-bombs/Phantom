package com.example.phantom.crypto.ton;

import com.iwebpp.crypto.TweetNaclFast;
import org.springframework.stereotype.Service;
import org.ton.ton4j.address.Address;
import org.ton.ton4j.mnemonic.Mnemonic;
import org.ton.ton4j.mnemonic.Pair;
import org.ton.ton4j.smartcontract.wallet.v5.WalletV5;
import java.util.HexFormat;

@Service
public class TonKeyService {

    private final boolean testnet;

    public record KeyPair(String address, String privateKey) {}

    public TonKeyService(TonConfig tonConfig) {
        this.testnet = tonConfig.isTestnet();
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
        String address = testnet ? walletAddress.toNonBounceableTestnet() : walletAddress.toNonBounceable();
        return new KeyPair(address, HexFormat.of().formatHex(keys.getSecretKey()));
    }

    public TweetNaclFast.Signature.KeyPair deriveSignatureKeyPair(String mnemonic) throws TonApiException {
        Pair keys;
        try { keys = Mnemonic.toKeyPair(mnemonic); }
        catch (Exception e) { throw new TonApiException(e.getMessage()); }
        return TweetNaclFast.Signature.keyPair_fromSeed(keys.getSecretKey());
    }

    private Address buildWalletAddress(TweetNaclFast.Signature.KeyPair keyPair, TonWalletVersion version) {
        return switch (version) {
            case V5 -> WalletV5.builder().wc(0).keyPair(keyPair).walletId(TonConstants.WALLET_ID_V5).isSigAuthAllowed(true).build().getAddress();
        };
    }
}