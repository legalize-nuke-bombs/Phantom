package com.example.phantom.pow;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class PowService {

    private static final long TTL_MS = 5 * 60_000L;

    private final byte[] secret;
    private final int difficulty;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Long> used = new ConcurrentHashMap<>();

    public PowService(@Value("${pow.secret}") String secret, @Value("${pow.difficulty}") int difficulty) {
        byte[] key;
        try {
            key = Base64.getDecoder().decode(secret);
        }
        catch (IllegalArgumentException e) {
            throw new IllegalStateException("pow.secret must be Base64-encoded");
        }
        if (key.length < 32) {
            throw new IllegalStateException("pow.secret must decode to at least 32 bytes");
        }
        this.secret = key;
        this.difficulty = difficulty;
        log.info("initialization, secret length {} bytes, difficulty {} bits", this.secret.length, difficulty);
    }

    public Challenge issue() {
        byte[] s = new byte[16];
        random.nextBytes(s);

        String salt = HexFormat.of().formatHex(s);
        long ts = System.currentTimeMillis() + TTL_MS;

        Challenge challenge = new Challenge(salt, ts, hmacHex(salt + ":" + ts), difficulty);
        log.info("new challenge provided salt {} ts {} sig {} diff {}", challenge.salt(), challenge.ts(), challenge.sig(), challenge.difficulty());
        return challenge;
    }

    public void verify(PowProof pow) {
        if (pow == null || pow.salt() == null || pow.sig() == null || pow.nonce() == null) {
            log.info("verify rejected: null field(s)");
            throw new ApiException(ErrorCode.POW_REQUIRED);
        }

        long ts = pow.ts();
        if (System.currentTimeMillis() > ts) {
            log.info("verify rejected: expired challenge");
            throw new ApiException(ErrorCode.POW_INVALID);
        }

        if (!MessageDigest.isEqual(pow.sig().getBytes(StandardCharsets.UTF_8), hmacHex(pow.salt() + ":" + ts).getBytes(StandardCharsets.UTF_8))) {
            log.info("verify rejected: invalid sig");
            throw new ApiException(ErrorCode.POW_INVALID);
        }

        if (leadingZeroBits(sha256(pow.salt() + ":" + pow.nonce())) < difficulty) {
            log.info("verify rejected: invalid nonce");
            throw new ApiException(ErrorCode.POW_INVALID);
        }
        if (used.putIfAbsent(pow.salt(), ts) != null) {
            log.info("verify rejected: challenge already completed");
            throw new ApiException(ErrorCode.POW_INVALID);
        }

        log.info("verified successful");
    }

    @Scheduled(fixedDelay = 60L * 1000)
    void cleanExpired() {
        log.debug("cleaning expired challenges...");
        long now = System.currentTimeMillis();
        used.values().removeIf(expiry -> now > expiry);
    }

    private String hmacHex(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        }
        catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] sha256(String data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data.getBytes(StandardCharsets.UTF_8));
        }
        catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static int leadingZeroBits(byte[] hash) {
        int bits = 0;
        for (byte b : hash) {
            int v = b & 0xFF;
            if (v == 0) {
                bits += 8;
                continue;
            }
            bits += Integer.numberOfLeadingZeros(v) - 24;
            break;
        }
        return bits;
    }
}
