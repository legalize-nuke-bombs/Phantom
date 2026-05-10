package com.example.phantom.crypto.ton;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.ton.ton4j.address.Address;
import org.ton.ton4j.toncenter.TonCenter;
import org.ton.ton4j.toncenter.TonResponse;
import org.ton.ton4j.toncenter.model.TransactionResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

@Service
@Slf4j
public class TonReadService {

    private final TonCenter tonCenter;
    private final RestClient v3Client;

    public record IncomingTransfer(String txHash, BigDecimal amountTon) {}
    private record V3TransactionsByMessageResponse(List<V3Transaction> transactions) {}
    private record V3Transaction(String hash) {}

    public TonReadService(TonCenter tonCenter, @Qualifier("tonCenterV3Client") RestClient v3Client) {
        this.tonCenter = tonCenter;
        this.v3Client = v3Client;
    }

    public BigDecimal getBalance(String address) throws TonApiException {
        log.info("getting balance for {}...", address);
        try {
            BigDecimal result = new BigDecimal(tonCenter.getBalance(Address.of(address))).divide(TonConstants.NANOTON, 9, RoundingMode.DOWN);
            log.info("got balance for {} : {} TON", address, result);
            return result;
        }
        catch (Throwable e) {
            log.error("failed to get balance for {} : {}", address, e.getMessage());
            throw new TonApiException("failed to get balance for " + address + ": " + e.getMessage());
        }
    }

    // TODO: Sometimes freezes than throws without visible reason
    public List<IncomingTransfer> getIncomingTransfers(String address, int limit) throws TonApiException {
        log.info("getting {} last incoming transfers for {}...", limit, address);

        TonResponse<List<TransactionResponse>> response;
        try { response = tonCenter.getTransactions(address, limit); }
        catch (Throwable e) {
            log.error("failed to get incoming transfers for {}", address);
            throw new TonApiException("failed to get incoming transfers for " + address);
        }

        if (response == null || !response.isSuccess() || response.getResult() == null) {
            log.error("failed to get incoming transfers for {}", address);
            throw new TonApiException("failed to get incoming transfers for " + address);
        }

        List<IncomingTransfer> result = response.getResult().stream()
                .filter(tx -> tx.getInMsg() != null)
                .filter(tx -> tx.getInMsg().getSource() != null && !tx.getInMsg().getSource().isEmpty())
                .filter(tx -> tx.getInMsg().getValue() != null && new BigDecimal(tx.getInMsg().getValue()).compareTo(BigDecimal.ZERO) > 0)
                .map(tx -> new IncomingTransfer(tx.getTransactionId().getHash(), new BigDecimal(tx.getInMsg().getValue()).divide(TonConstants.NANOTON, 9, RoundingMode.DOWN)))
                .toList();
        log.info("got {} incoming transfers for {}", result.size(), address);
        return result;
    }

    // TODO: Sometimes freezes than throws without visible reason
    public TonTransferStatus checkStatus(String messageHash, Long sendTimestamp, Long validationDuration) throws TonApiException {
        log.info("checking status for {}...", messageHash);
        try {
            V3TransactionsByMessageResponse response = v3Client.get()
                    .uri("/transactionsByMessage?direction=in&msg_hash={hash}", messageHash)
                    .retrieve()
                    .body(V3TransactionsByMessageResponse.class);

            if (response != null && response.transactions() != null && !response.transactions().isEmpty()) {
                return TonTransferStatus.CONFIRMED;
            }
        }
        catch (Throwable e) {
            log.error("failed to check message confirmation");
            throw new TonApiException("failed to check message confirmation");
        }

        if (Instant.now().getEpochSecond() > sendTimestamp + validationDuration) {
            log.warn("status checked: rejected");
            return TonTransferStatus.REJECTED;
        }

        log.info("status checked: pending");
        return TonTransferStatus.PENDING;
    }
}