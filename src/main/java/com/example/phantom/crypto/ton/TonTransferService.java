package com.example.phantom.crypto.ton;

import com.iwebpp.crypto.TweetNaclFast;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class TonTransferService {

    private final TonCenter tonCenter;

    private final static String CONTRACT_DOES_NOT_EXIST_CODE = "-13";

    public TonTransferService(TonCenter tonCenter) {
        this.tonCenter = tonCenter;
    }

    public String send(String privateKeyHex, String toAddress, BigDecimal amountTon) throws TonApiException {
        log.info("sending {} TON to {}...", amountTon, toAddress);
        TweetNaclFast.Signature.KeyPair keyPair = TweetNaclFast.Signature.keyPair_fromSeed(HexFormat.of().parseHex(privateKeyHex));
        return send(keyPair, Destination.builder().address(toAddress).amount(amountTon.multiply(TonConstants.NANOTON).toBigInteger()).bounce(false).build());
    }

    public String sendAll(String privateKeyHex, String toAddress) throws TonApiException {
        log.info("sending everything to {}...", toAddress);
        TweetNaclFast.Signature.KeyPair keyPair = TweetNaclFast.Signature.keyPair_fromSeed(HexFormat.of().parseHex(privateKeyHex));
        return send(keyPair, Destination.builder().address(toAddress).amount(BigInteger.ZERO).mode(130).bounce(false).build());
    }

    // TODO: Sometimes freezes than throws without visible reason
    private String send(TweetNaclFast.Signature.KeyPair keyPair, Destination destination) throws TonApiException {
        WalletV5 wallet = WalletV5.builder().tonProvider(tonCenter).wc(0).keyPair(keyPair).walletId(TonConstants.WALLET_ID_V5).isSigAuthAllowed(true).build();

        long seqno;
        try { seqno = wallet.getSeqno(); }
        catch (Throwable e) {
            if (String.valueOf(e.getMessage()).contains(CONTRACT_DOES_NOT_EXIST_CODE)) { seqno = 0; }
            else {
                log.error("failed to get seqno");
                throw new TonApiException("failed to get seqno");
            }
        }

        WalletV5Config config = WalletV5Config.builder().walletId(TonConstants.WALLET_ID_V5).seqno(seqno).recipients(List.of(destination)).build();

        Message message = wallet.prepareExternalMsg(config);

        TonResponse<SendBocResponse> response;
        try { response = tonCenter.sendBocReturnHash(message.toCell().toBase64()); }
        catch (Throwable e) {
            log.error("failed to send");
            throw new TonApiException("failed to send");
        }

        if (response == null || !response.isSuccess()) {
            log.error("failed to send: response is empty");
            throw new TonApiException("failed to send: response is empty");
        }

        log.info("sending done");

        return response.getResult().getHash();
    }
}