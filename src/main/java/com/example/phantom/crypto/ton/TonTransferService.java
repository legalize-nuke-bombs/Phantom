package com.example.phantom.crypto.ton;

import com.iwebpp.crypto.TweetNaclFast;
import org.springframework.stereotype.Service;
import org.ton.ton4j.smartcontract.SendMode;
import org.ton.ton4j.smartcontract.types.Destination;
import org.ton.ton4j.smartcontract.types.WalletV5Config;
import org.ton.ton4j.smartcontract.wallet.v5.WalletV5;
import org.ton.ton4j.tlb.Message;
import org.ton.ton4j.toncenter.TonCenter;
import org.ton.ton4j.toncenter.TonResponse;
import org.ton.ton4j.toncenter.model.SendBocResponse;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.HexFormat;
import java.util.List;

@Service
public class TonTransferService {

    private final TonCenter tonCenter;

    private final static String CONTRACT_DOES_NOT_EXIST_CODE = "-13";

    public TonTransferService(TonCenter tonCenter) {
        this.tonCenter = tonCenter;
    }

    public String send(String privateKeyHex, String toAddress, BigDecimal amountTon) throws TonApiException {
        TweetNaclFast.Signature.KeyPair keyPair = TweetNaclFast.Signature.keyPair_fromSeed(HexFormat.of().parseHex(privateKeyHex));
        return send(keyPair, Destination.builder().address(toAddress).amount(amountTon.multiply(TonConstants.NANOTON).toBigInteger()).bounce(false).build());
    }

    public String sendAll(String privateKeyHex, String toAddress) throws TonApiException {
        TweetNaclFast.Signature.KeyPair keyPair = TweetNaclFast.Signature.keyPair_fromSeed(HexFormat.of().parseHex(privateKeyHex));
        return send(keyPair, Destination.builder().address(toAddress).amount(BigInteger.ZERO).mode(130).bounce(false).build());
    }

    private String send(TweetNaclFast.Signature.KeyPair keyPair, Destination destination) throws TonApiException {
        WalletV5 wallet = WalletV5.builder().tonProvider(tonCenter).wc(0).keyPair(keyPair).walletId(TonConstants.WALLET_ID_V5).isSigAuthAllowed(true).build();

        long seqno;
        try { seqno = wallet.getSeqno(); }
        catch (Throwable e) {
            if (String.valueOf(e.getMessage()).contains(CONTRACT_DOES_NOT_EXIST_CODE)) { seqno = 0; }
            else { throw new TonApiException("failed to get seqno"); }
        }

        WalletV5Config config = WalletV5Config.builder().walletId(TonConstants.WALLET_ID_V5).seqno(seqno).recipients(List.of(destination)).build();

        Message message = wallet.prepareExternalMsg(config);

        TonResponse<SendBocResponse> response;
        try { response = tonCenter.sendBocReturnHash(message.toCell().toBase64()); }
        catch (Throwable e) { throw new TonApiException("failed to send payment"); }

        if (response == null || !response.isSuccess()) {
            throw new TonApiException("failed to send payment: " + (response != null ? response.getError() : "null response"));
        }

        return response.getResult().getHash();
    }
}