package com.example.phantom.crypto;

import java.math.BigDecimal;
import java.util.List;

public interface CoinProvider {
    String coin();

    void validateAddress(String address);

    BigDecimal getBalanceUsd(String address) throws CryptoException;
    List<IncomingTransfer> getIncomingTransfers(String address, int limit) throws CryptoException;
    String send(String privateKey, String fromAddress, String toAddress, BigDecimal amountUsd) throws CryptoException;
    String sendAll(String privateKey, String fromAddress, String toAddress) throws CryptoException;
    TransferStatus checkTransferStatus(String hash, long sendTimestamp) throws CryptoException;

    String generateMnemonic() throws CryptoException;
    KeyPair deriveKeyPair(String mnemonic) throws CryptoException;

    BigDecimal getWithdrawalCommission();
    BigDecimal getMinSweepAmount();

    record IncomingTransfer(String txHash, BigDecimal amountUsd) {}
    record KeyPair(String address, String privateKey) {}
}
