package com.example.phantom.crypto.ton;

import org.springframework.stereotype.Service;
import org.ton.ton4j.address.Address;
import org.ton.ton4j.toncenter.TonCenter;
import org.ton.ton4j.toncenter.TonResponse;
import org.ton.ton4j.toncenter.model.TransactionResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class TonReadService {

    private final TonCenter tonCenter;

    public record IncomingTransfer(String txHash, BigDecimal amountTon) {}

    public TonReadService(TonCenter tonCenter) {
        this.tonCenter = tonCenter;
    }

    public BigDecimal getBalance(String address) throws TonApiException {
        try { return new BigDecimal(tonCenter.getBalance(Address.of(address))).divide(TonConstants.NANOTON, 9, RoundingMode.DOWN); }
        catch (Exception e) { throw new TonApiException("failed to get balance for " + address); }
    }

    public List<IncomingTransfer> getIncomingTransfers(String address, int limit) throws TonApiException {
        TonResponse<List<TransactionResponse>> response;
        try { response = tonCenter.getTransactions(address, limit); }
        catch (Exception e) { throw new TonApiException("failed to get transactions for " + address); }

        if (response == null || !response.isSuccess() || response.getResult() == null) {
            throw new TonApiException("failed to get transactions for " + address);
        }

        return response.getResult().stream()
                .filter(tx -> tx.getInMsg() != null)
                .filter(tx -> tx.getInMsg().getSource() != null && !tx.getInMsg().getSource().isEmpty())
                .filter(tx -> tx.getInMsg().getValue() != null && new BigDecimal(tx.getInMsg().getValue()).compareTo(BigDecimal.ZERO) > 0)
                .map(tx -> new IncomingTransfer(tx.getTransactionId().getHash(), new BigDecimal(tx.getInMsg().getValue()).divide(TonConstants.NANOTON, 9, RoundingMode.DOWN)))
                .toList();
    }
}