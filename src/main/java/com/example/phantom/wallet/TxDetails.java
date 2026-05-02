package com.example.phantom.wallet;

public record TxDetails(
        String txId,
        TxStatus status,
        TxToken token,
        String toAddress,
        long rawAmount
) {
    public enum TxStatus { SUCCESS, FAILED, PENDING }
    public enum TxToken { TRX, USDT }
}