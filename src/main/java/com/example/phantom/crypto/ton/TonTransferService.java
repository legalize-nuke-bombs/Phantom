package com.example.phantom.crypto.ton;

import com.iwebpp.crypto.TweetNaclFast;
import org.springframework.stereotype.Service;
import org.ton.ton4j.smartcontract.types.Destination;
import org.ton.ton4j.smartcontract.types.WalletV5Config;
import org.ton.ton4j.smartcontract.wallet.v5.WalletV5;
import org.ton.ton4j.tlb.Message;
import org.ton.ton4j.toncenter.TonCenter;
import org.ton.ton4j.toncenter.TonResponse;
import org.ton.ton4j.toncenter.model.SendBocResponse;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;

@Service
public class TonTransferService {

    private final TonCenter tonCenter;
    private final TonKeyService tonKeyService;

    public TonTransferService(TonCenter tonCenter, TonKeyService tonKeyService) {
        this.tonCenter = tonCenter;
        this.tonKeyService = tonKeyService;
    }

    public String sendPayment(String mnemonic, String toAddress, BigDecimal amountTon) throws TonApiException {
        TweetNaclFast.Signature.KeyPair keyPair = tonKeyService.deriveSignatureKeyPair(mnemonic);
        BigInteger amountNano = amountTon.multiply(TonConstants.NANOTON).toBigInteger();

        WalletV5 wallet = WalletV5.builder().tonProvider(tonCenter).wc(0).keyPair(keyPair).walletId(TonConstants.WALLET_ID_V5).isSigAuthAllowed(true).build();

        long seqno;
        try { seqno = wallet.getSeqno(); }
        catch (Exception e) { throw new TonApiException("failed to get seqno"); }

        WalletV5Config config = WalletV5Config.builder().walletId(TonConstants.WALLET_ID_V5).seqno(seqno).recipients(List.of(Destination.builder().address(toAddress).amount(amountNano).bounce(false).build())).build();

        Message message = wallet.prepareExternalMsg(config);

        TonResponse<SendBocResponse> response;
        try { response = tonCenter.sendBocReturnHash(message.toCell().toBase64()); }
        catch (Exception e) { throw new TonApiException("failed to send payment"); }

        if (response == null || !response.isSuccess()) {
            throw new TonApiException("failed to send payment: " + (response != null ? response.getError() : "null response"));
        }

        return response.getResult().getHash();
    }
}