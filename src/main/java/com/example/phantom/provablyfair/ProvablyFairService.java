package com.example.phantom.provablyfair;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import org.springframework.stereotype.Service;

import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Random;

@Service
public class ProvablyFairService {
    private final SecureRandom random;

    public ProvablyFairService() {
        random = new SecureRandom();
    }

    static private final int SEED_RAW_LENGTH = 32;
    static public final int SEED_LENGTH = 2 * SEED_RAW_LENGTH;

    public String generateSeed() {
        byte[] rawSeed = new byte[SEED_RAW_LENGTH];
        random.nextBytes(rawSeed);
        return HexFormat.of().formatHex(rawSeed);
    }

    public String generateHash(String seed) {
        byte[] rawSeed = parseSeed(seed);
        byte[] rawHash = sha256().digest(rawSeed);
        return HexFormat.of().formatHex(rawHash);
    }

    public Random fairRandom(String seed1, String seed2) {
        byte[] rawSeed1 = parseSeed(seed1);
        byte[] rawSeed2 = parseSeed(seed2);

        byte[] combined = new byte[rawSeed1.length + rawSeed2.length];
        System.arraycopy(rawSeed1, 0, combined, 0, rawSeed1.length);
        System.arraycopy(rawSeed2, 0, combined, rawSeed1.length, rawSeed2.length);

        byte[] token = sha256().digest(combined);
        long rngSeed = ByteBuffer.wrap(token, 0, 8).getLong();
        return new Random(rngSeed);
    }

    private byte[] parseSeed(String seed) {
        if (seed.length() != SEED_LENGTH) {
            throw new ApiException(ErrorCode.INVALID_SEED);
        }

        byte[] rawSeed;
        try {
            rawSeed = HexFormat.of().parseHex(seed);
        }
        catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.INVALID_SEED);
        }

        return rawSeed;
    }

    private MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        }
        catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("no such algorithm");
        }
    }
}
