package com.example.phantom.ton;

import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoExchangeRateService;
import com.example.phantom.crypto.TransferStatus;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.finance.FinanceConstants;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iwebpp.crypto.TweetNaclFast;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.ton.ton4j.address.Address;
import org.ton.ton4j.mnemonic.Mnemonic;
import org.ton.ton4j.mnemonic.Pair;
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
import java.util.regex.Pattern;

@Component
@Slf4j
public class TonCoinProvider implements CoinProvider {

    private static final BigDecimal NANOTON = new BigDecimal("1000000000");
    private static final long WALLET_ID_V5 = 2147483409L;
    private static final BigDecimal WITHDRAWAL_COMMISSION = new BigDecimal("0.1");
    private static final BigDecimal MIN_SWEEP_AMOUNT = new BigDecimal("0.1");
    private static final long VALIDATION_DURATION = 10 * 60;
    private static final Pattern ADDRESS_PATTERN = Pattern.compile("^(EQ|UQ)[A-Za-z0-9_-]{46}$");

    private final RestClient client;
    private final ObjectMapper mapper = new ObjectMapper();
    private final boolean testnet;
    private final CryptoExchangeRateService exchangeRateService;

    public TonCoinProvider(TonConfig config, CryptoExchangeRateService exchangeRateService) {
        this.testnet = config.isTestnet();
        this.exchangeRateService = exchangeRateService;

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

    @Override
    public String coin() {
        return "TON";
    }

    @Override
    public void validateAddress(String address) {
        if (address == null || !ADDRESS_PATTERN.matcher(address).matches()) {
            throw new BadRequestException("invalid TON address");
        }
    }

    @Override
    public BigDecimal getBalanceUsd(String address) throws CryptoException {
        BigDecimal balanceTon = getBalance(address);
        BigDecimal rate = exchangeRateService.getTonUsdt();
        return balanceTon.multiply(rate).setScale(FinanceConstants.SCALE, RoundingMode.DOWN);
    }

    @Override
    public List<IncomingTransfer> getIncomingTransfers(String address, int limit) throws CryptoException {
        List<RawTransfer> tonTransfers = getRawIncomingTransfers(address, limit);

        if (tonTransfers.isEmpty()) {
            return List.of();
        }

        BigDecimal rate = exchangeRateService.getTonUsdt();

        return tonTransfers.stream()
                .map(tx -> new IncomingTransfer(
                        tx.txHash(),
                        tx.amountTon().multiply(rate).setScale(FinanceConstants.SCALE, RoundingMode.DOWN)))
                .toList();
    }

    @Override
    public String send(String privateKey, String fromAddress, String toAddress, BigDecimal amountUsd) throws CryptoException {
        BigDecimal rate = exchangeRateService.getTonUsdt();
        BigDecimal amountTon = amountUsd.divide(rate, FinanceConstants.SCALE, RoundingMode.DOWN);
        BigDecimal amountNanoton = amountTon.multiply(NANOTON);

        log.info("sending {} nanoton from {} to {}...", amountNanoton, fromAddress, toAddress);

        Destination dest = Destination.builder()
                .address(toAddress)
                .amount(amountNanoton.toBigInteger())
                .bounce(false)
                .build();

        return signAndSend(privateKey, fromAddress, dest);
    }

    @Override
    public String sendAll(String privateKey, String fromAddress, String toAddress) throws CryptoException {
        log.info("sending all from {} to {}...", fromAddress, toAddress);

        Destination dest = Destination.builder()
                .address(toAddress)
                .amount(BigInteger.ZERO)
                .mode(130)
                .bounce(false)
                .build();

        return signAndSend(privateKey, fromAddress, dest);
    }

    @Override
    public TransferStatus checkTransferStatus(String hash, long sendTimestamp) throws CryptoException {
        log.info("checking status for {}...", hash);
        try {
            String raw = client.get()
                    .uri("/api/v3/transactionsByMessage?direction=in&msg_hash={h}", hash)
                    .retrieve()
                    .body(String.class);

            JsonNode root = mapper.readTree(raw);
            JsonNode txs = root.path("transactions");
            if (txs.isArray() && !txs.isEmpty()) {
                JsonNode action = txs.get(0).path("description").path("action");
                int skipped = action.path("skipped_actions").asInt(0);
                if (skipped == 0) {
                    log.info("status for {} : confirmed", hash);
                    return TransferStatus.CONFIRMED;
                }
                log.info("status for {} : rejected", hash);
                return TransferStatus.REJECTED;
            }
        }
        catch (Exception e) {
            throw new CryptoException("failed to check transfer status");
        }

        if (Instant.now().getEpochSecond() > sendTimestamp + VALIDATION_DURATION) {
            log.warn("status for {}: rejected (timed out)", hash);
            return TransferStatus.REJECTED;
        }

        log.info("status for {}: pending", hash);
        return TransferStatus.PENDING;
    }

    @Override
    public String generateMnemonic() throws CryptoException {
        try {
            return Mnemonic.generateString(24);
        }
        catch (Exception e) {
            throw new CryptoException(e.getMessage());
        }
    }

    @Override
    public KeyPair deriveKeyPair(String mnemonic) throws CryptoException {
        Pair keys;
        try {
            keys = Mnemonic.toKeyPair(mnemonic);
        }
        catch (Exception e) {
            throw new CryptoException(e.getMessage());
        }

        TweetNaclFast.Signature.KeyPair sigKeyPair = TweetNaclFast.Signature.keyPair_fromSeed(keys.getSecretKey());
        Address walletAddress = WalletV5.builder()
                .wc(0)
                .keyPair(sigKeyPair)
                .walletId(WALLET_ID_V5)
                .isSigAuthAllowed(true)
                .build()
                .getAddress();
        String address = testnet
                ? walletAddress.toNonBounceableTestnet()
                : walletAddress.toNonBounceable();
        return new KeyPair(address, HexFormat.of().formatHex(keys.getSecretKey()));
    }

    @Override
    public BigDecimal getWithdrawalCommission() {
        return WITHDRAWAL_COMMISSION;
    }

    @Override
    public BigDecimal getMinSweepAmount() {
        return MIN_SWEEP_AMOUNT;
    }



    private record RawTransfer(String txHash, BigDecimal amountTon) {}

    private BigDecimal getBalance(String address) throws CryptoException {
        log.info("getting balance for {}...", address);
        JsonNode result = v2Get("/api/v2/getAddressBalance?address={a}", address);
        BigDecimal nanotons = new BigDecimal(result.asText());
        BigDecimal tons = nanotons.divide(NANOTON, 9, RoundingMode.DOWN);
        log.info("balance for {}: {} TON", address, tons);
        return tons;
    }

    private List<RawTransfer> getRawIncomingTransfers(String address, int limit) throws CryptoException {
        log.info("getting {} last incoming transfers for {}...", limit, address);
        JsonNode result = v2Get("/api/v2/getTransactions?address={a}&limit={l}", address, limit);

        List<RawTransfer> transfers = new ArrayList<>();
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

            transfers.add(new RawTransfer(
                    hash,
                    amount.divide(NANOTON, 9, RoundingMode.DOWN)
            ));
        }

        log.info("got {} incoming transfers for {}", transfers.size(), address);
        return transfers;
    }

    private String signAndSend(String privateKeyHex, String fromAddress, Destination destination) throws CryptoException {
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
        catch (CryptoException e) {
            log.warn("seqno lookup failed for {} (contract may not exist), defaulting to 0", address);
            return 0;
        }
        catch (Exception e) {
            log.warn("failed to parse seqno for {}, defaulting to 0", address);
            return 0;
        }
    }

    private String buildBoc(String privateKeyHex, long seqno, Destination destination) throws CryptoException {
        try {
            TweetNaclFast.Signature.KeyPair keyPair = TweetNaclFast.Signature.keyPair_fromSeed(
                    HexFormat.of().parseHex(privateKeyHex)
            );

            WalletV5 wallet = WalletV5.builder()
                    .wc(0)
                    .keyPair(keyPair)
                    .walletId(WALLET_ID_V5)
                    .isSigAuthAllowed(true)
                    .build();

            WalletV5Config config = WalletV5Config.builder()
                    .walletId(WALLET_ID_V5)
                    .seqno(seqno)
                    .recipients(List.of(destination))
                    .build();

            Message message = wallet.prepareExternalMsg(config);
            return message.toCell().toBase64();
        }
        catch (Throwable e) {
            throw new CryptoException("failed to build boc: " + e.getMessage());
        }
    }

    private String sendBoc(String bocBase64) throws CryptoException {
        log.info("sending boc...");
        try {
            String body = mapper.writeValueAsString(Map.of("boc", bocBase64));
            JsonNode result = v2Post("/api/v2/sendBocReturnHash", body);

            String hash = result.path("hash").asText(null);
            if (hash == null) {
                throw new CryptoException("sendBoc returned no hash");
            }

            log.info("boc sent, hash: {}", hash);
            return hash;
        }
        catch (CryptoException e) {
            throw e;
        }
        catch (Exception e) {
            throw new CryptoException("failed to send boc: " + e.getMessage());
        }
    }

    private JsonNode v2Get(String uri, Object... vars) throws CryptoException {
        try {
            String raw = client.get()
                    .uri(uri, vars)
                    .retrieve()
                    .body(String.class);

            return extractV2Result(raw);
        }
        catch (CryptoException e) {
            throw e;
        }
        catch (Exception e) {
            throw new CryptoException("toncenter request failed: " + e.getMessage());
        }
    }

    private JsonNode v2Post(String uri, String body) throws CryptoException {
        try {
            String raw = client.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            return extractV2Result(raw);
        }
        catch (CryptoException e) {
            throw e;
        }
        catch (Exception e) {
            throw new CryptoException("toncenter request failed: " + e.getMessage());
        }
    }

    private JsonNode extractV2Result(String raw) throws CryptoException {
        try {
            JsonNode root = mapper.readTree(raw);

            if (!root.path("ok").asBoolean(false)) {
                throw new CryptoException("toncenter error: " + root.path("error").asText("unknown"));
            }

            return root.path("result");
        }
        catch (CryptoException e) {
            throw e;
        }
        catch (Exception e) {
            throw new CryptoException("failed to parse toncenter response");
        }
    }
}
