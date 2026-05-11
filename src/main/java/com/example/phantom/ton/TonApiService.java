package com.example.phantom.ton;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iwebpp.crypto.TweetNaclFast;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.ton.ton4j.smartcontract.types.Destination;
import org.ton.ton4j.smartcontract.types.WalletV5Config;
import org.ton.ton4j.smartcontract.wallet.v5.WalletV5;
import org.ton.ton4j.tlb.Message;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class TonApiService {

    private final RestClient client;
    private final ObjectMapper mapper = new ObjectMapper();

    public record IncomingTransfer(String txHash, BigDecimal amountTon) {}

    public TonApiService(TonConfig config) {
        String baseUrl = config.isTestnet()
                ? "https://testnet.toncenter.com"
                : "https://toncenter.com";

        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("X-API-Key", config.getApiKey())
                .requestFactory(new SimpleClientHttpRequestFactory() {{
                    setConnectTimeout(Duration.ofSeconds(10));
                    setReadTimeout(Duration.ofSeconds(15));
                }})
                .build();
    }



    public BigDecimal getBalance(String address) throws TonApiException {
        log.info("getting balance for {}...", address);
        JsonNode result = v2Get("/api/v2/getAddressBalance?address={a}", address);
        BigDecimal nanotons = new BigDecimal(result.asText());
        BigDecimal tons = nanotons.divide(TonConstants.NANOTON, 9, RoundingMode.DOWN);
        log.info("balance for {}: {} TON", address, tons);
        return tons;
    }

    public List<IncomingTransfer> getIncomingTransfers(String address, int limit) throws TonApiException {
        log.info("getting {} last incoming transfers for {}...", limit, address);
        JsonNode result = v2Get("/api/v2/getTransactions?address={a}&limit={l}", address, limit);

        List<IncomingTransfer> transfers = new ArrayList<>();
        for (JsonNode tx : result) {
            JsonNode inMsg = tx.path("in_msg");
            String source = inMsg.path("source").asText("");
            String value = inMsg.path("value").asText("0");
            String hash = tx.path("transaction_id").path("hash").asText("");

            if (source.isEmpty() || hash.isEmpty()) {
                continue;
            }

            BigDecimal amount = new BigDecimal(value);
            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            transfers.add(new IncomingTransfer(
                    hash,
                    amount.divide(TonConstants.NANOTON, 9, RoundingMode.DOWN)
            ));
        }

        log.info("got {} incoming transfers for {}", transfers.size(), address);
        return transfers;
    }

    public String send(String privateKeyHex, String fromAddress, String toAddress, BigDecimal amountNanoton) throws TonApiException {
        log.info("sending {} nanoton from {} to {}...", amountNanoton, fromAddress, toAddress);

        Destination dest = Destination.builder()
                .address(toAddress)
                .amount(amountNanoton.toBigInteger())
                .bounce(false)
                .build();

        return signAndSend(privateKeyHex, fromAddress, dest);
    }

    public String sendAll(String privateKeyHex, String fromAddress, String toAddress) throws TonApiException {
        log.info("sending all from {} to {}...", fromAddress, toAddress);

        Destination dest = Destination.builder()
                .address(toAddress)
                .amount(BigInteger.ZERO)
                .mode(130)
                .bounce(false)
                .build();

        return signAndSend(privateKeyHex, fromAddress, dest);
    }

    public TonTransferStatus checkTransferStatus(
            String messageHash,
            long sendTimestamp,
            long validationDuration
    ) throws TonApiException {
        log.info("checking status for {}...", messageHash);
        try {
            String raw = client.get()
                    .uri("/api/v3/transactionsByMessage?direction=in&msg_hash={h}", messageHash)
                    .retrieve()
                    .body(String.class);

            JsonNode root = mapper.readTree(raw);
            JsonNode txs = root.path("transactions");
            if (txs.isArray() && !txs.isEmpty()) {
                JsonNode action = txs.get(0).path("description").path("action");
                int skipped = action.path("skipped_actions").asInt(0);
                if (skipped == 0) {
                    log.info("status for {} : confirmed", messageHash);
                    return TonTransferStatus.CONFIRMED;
                }
                log.info("status for {} : rejected", messageHash);
                return TonTransferStatus.REJECTED;
            }
        }
        catch (Exception e) {
            throw new TonApiException("failed to check transfer status");
        }

        if (Instant.now().getEpochSecond() > sendTimestamp + validationDuration) {
            log.warn("status for {}: rejected (timed out)", messageHash);
            return TonTransferStatus.REJECTED;
        }

        log.info("status for {}: pending", messageHash);
        return TonTransferStatus.PENDING;
    }



    private String signAndSend(String privateKeyHex, String fromAddress, Destination destination) throws TonApiException {
        long seqno = getSeqno(fromAddress);
        String boc = buildBoc(privateKeyHex, seqno, destination);
        return sendBoc(boc);
    }

    private long getSeqno(String address) {
        log.info("getting seqno for {}...", address);
        try {
            String body = mapper.writeValueAsString(
                    Map.of("address", address, "method", "seqno", "stack", List.of())
            );
            JsonNode result = v2Post("/api/v2/runGetMethod", body);

            int exitCode = result.path("exit_code").asInt(-1);
            if (exitCode != 0) {
                return 0;
            }

            JsonNode stack = result.path("stack");
            if (stack.isEmpty()) {
                return 0;
            }

            String hex = stack.get(0).get(1).asText("0x0");
            return Long.parseLong(hex.replace("0x", ""), 16);
        }
        catch (TonApiException e) {
            log.warn("seqno lookup failed for {} (contract may not exist), defaulting to 0", address);
            return 0;
        }
        catch (Exception e) {
            log.warn("failed to parse seqno for {}, defaulting to 0", address);
            return 0;
        }
    }

    private String buildBoc(String privateKeyHex, long seqno, Destination destination) throws TonApiException {
        try {
            TweetNaclFast.Signature.KeyPair keyPair = TweetNaclFast.Signature.keyPair_fromSeed(
                    HexFormat.of().parseHex(privateKeyHex)
            );

            WalletV5 wallet = WalletV5.builder()
                    .wc(0)
                    .keyPair(keyPair)
                    .walletId(TonConstants.WALLET_ID_V5)
                    .isSigAuthAllowed(true)
                    .build();

            WalletV5Config config = WalletV5Config.builder()
                    .walletId(TonConstants.WALLET_ID_V5)
                    .seqno(seqno)
                    .recipients(List.of(destination))
                    .build();

            Message message = wallet.prepareExternalMsg(config);
            return message.toCell().toBase64();
        }
        catch (Throwable e) {
            throw new TonApiException("failed to build boc: " + e.getMessage());
        }
    }

    private String sendBoc(String bocBase64) throws TonApiException {
        log.info("sending boc...");
        try {
            String body = mapper.writeValueAsString(Map.of("boc", bocBase64));
            JsonNode result = v2Post("/api/v2/sendBocReturnHash", body);

            String hash = result.path("hash").asText(null);
            if (hash == null) {
                throw new TonApiException("sendBoc returned no hash");
            }

            log.info("boc sent, hash: {}", hash);
            return hash;
        }
        catch (TonApiException e) {
            throw e;
        }
        catch (Exception e) {
            throw new TonApiException("failed to send boc: " + e.getMessage());
        }
    }



    private JsonNode v2Get(String uri, Object... vars) throws TonApiException {
        try {
            String raw = client.get()
                    .uri(uri, vars)
                    .retrieve()
                    .body(String.class);

            return extractV2Result(raw);
        }
        catch (TonApiException e) {
            throw e;
        }
        catch (Exception e) {
            throw new TonApiException("toncenter request failed: " + e.getMessage());
        }
    }

    private JsonNode v2Post(String uri, String body) throws TonApiException {
        try {
            String raw = client.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            return extractV2Result(raw);
        }
        catch (TonApiException e) {
            throw e;
        }
        catch (Exception e) {
            throw new TonApiException("toncenter request failed: " + e.getMessage());
        }
    }

    private JsonNode extractV2Result(String raw) throws TonApiException {
        try {
            JsonNode root = mapper.readTree(raw);

            if (!root.path("ok").asBoolean(false)) {
                throw new TonApiException("toncenter error: " + root.path("error").asText("unknown"));
            }

            return root.path("result");
        }
        catch (TonApiException e) {
            throw e;
        }
        catch (Exception e) {
            throw new TonApiException("failed to parse toncenter response");
        }
    }
}
