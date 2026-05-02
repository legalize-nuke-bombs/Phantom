package com.example.phantom.wallet;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.tron.trident.core.ApiWrapper;
import org.tron.trident.core.contract.Trc20Contract;
import org.tron.trident.proto.Chain.Transaction;
import org.tron.trident.proto.Contract.TransferContract;
import org.tron.trident.proto.Response.TransactionExtention;
import org.tron.trident.proto.Response.TransactionInfo;
import org.tron.trident.proto.Response.TransactionInfo.Log;
import org.tron.trident.utils.Base58Check;
import java.math.BigInteger;

@Component
public class TronApiClient {

    private final String apiKey;
    private final String network;
    private final String usdtContract;
    private final long feeLimit;
    private final ApiWrapper apiWrapper;

    TronApiClient(@Value("${tron.usdt-contract}") String usdtContract,
                  @Value("${tron.fee-limit}") long feeLimit,
                  @Value("${tron.network}") String network,
                  @Value("${tron.trongrid-api-key}") String apiKey,
                  @Qualifier("tronPrivateKey") String privateKey) {
        this.usdtContract = usdtContract;
        this.feeLimit = feeLimit;
        this.network = network;
        this.apiKey = apiKey;
        this.apiWrapper = createApiWrapper(privateKey);
    }

    public long getTrxBalance(String address) throws TronApiException {
        try {
            return apiWrapper.getAccount(address).getBalance();
        }
        catch (Exception e) {
            throw new TronApiException("Failed to get TRX balance");
        }
    }

    public BigInteger getUsdtBalance(String address) throws TronApiException {
        try {
            return getUsdtContract(apiWrapper).balanceOf(address);
        }
        catch (Exception e) {
            throw new TronApiException("Failed to get USDT balance");
        }
    }

    public String sendTrx(String fromPrivateKey, String toAddress, long sunAmount) throws TronApiException {
        ApiWrapper sender = createApiWrapper(fromPrivateKey);

        try {
            String fromAddress = sender.keyPair.toBase58CheckAddress();

            TransactionExtention tx = sender.transfer(fromAddress, toAddress, sunAmount);
            Transaction signed = sender.signTransaction(tx);

            return sender.broadcastTransaction(signed);
        }
        catch (Exception e) {
            throw new TronApiException("TRX transfer failed");
        }
        finally {
            sender.close();
        }
    }

    public String sendUsdt(String fromPrivateKey, String toAddress, long rawAmount) throws TronApiException {
        ApiWrapper sender = createApiWrapper(fromPrivateKey);

        try {
            Trc20Contract token = getUsdtContract(sender);
            String txId = token.transfer(toAddress, rawAmount, 0, "", feeLimit);

            if (txId == null || txId.isEmpty()) {
                throw new TronApiException("USDT transfer returned empty txId");
            }

            return txId;
        }
        catch (TronApiException e) {
            throw e;
        }
        catch (Exception e) {
            throw new TronApiException("USDT transfer failed");
        }
        finally {
            sender.close();
        }
    }

    public TxDetails getTransactionDetails(String txId) throws TronApiException {
        try {
            TransactionInfo info = apiWrapper.getTransactionInfoById(txId);

            if (info == null || info.getSerializedSize() == 0) {
                return new TxDetails(txId, TxDetails.TxStatus.PENDING, null, null, 0);
            }

            TxDetails.TxStatus status = info.getResult() == TransactionInfo.code.SUCESS
                    ? TxDetails.TxStatus.SUCCESS
                    : TxDetails.TxStatus.FAILED;

            for (Log log : info.getLogList()) {
                String contractAddr = toBase58(log.getAddress().toByteArray());

                if (!usdtContract.equals(contractAddr) || log.getTopicsCount() < 3) {
                    continue;
                }

                String to = toBase58(log.getTopics(2).substring(12).toByteArray());
                long amount = new BigInteger(1, log.getData().toByteArray()).longValueExact();

                return new TxDetails(txId, status, TxDetails.TxToken.USDT, to, amount);
            }

            Transaction tx = apiWrapper.getTransactionById(txId);
            var contractType = tx.getRawData().getContract(0).getType();

            if (contractType != Transaction.Contract.ContractType.TransferContract) {
                throw new TronApiException("Unsupported transaction type");
            }

            TransferContract transfer = tx.getRawData().getContract(0)
                    .getParameter().unpack(TransferContract.class);

            String to = toBase58(transfer.getToAddress().toByteArray());
            long amount = transfer.getAmount();

            return new TxDetails(txId, status, TxDetails.TxToken.TRX, to, amount);
        }
        catch (TronApiException e) {
            throw e;
        }
        catch (Exception e) {
            throw new TronApiException("Failed to get transaction details");
        }
    }

    private ApiWrapper createApiWrapper(String privateKey) {
        return switch (network) {
            case "nile" -> ApiWrapper.ofNile(privateKey);
            case "shasta" -> ApiWrapper.ofShasta(privateKey);
            default -> ApiWrapper.ofMainnet(privateKey, apiKey);
        };
    }

    private Trc20Contract getUsdtContract(ApiWrapper wrapper) {
        var contract = wrapper.getContract(usdtContract);
        return new Trc20Contract(contract, wrapper.keyPair.toBase58CheckAddress(), wrapper);
    }

    private static String toBase58(byte[] raw) {
        byte[] withPrefix = new byte[21];
        withPrefix[0] = 0x41;
        System.arraycopy(raw, 0, withPrefix, 1, 20);
        return Base58Check.bytesToBase58(withPrefix);
    }
}