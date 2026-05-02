package com.example.phantom.game.util;

import com.example.phantom.exception.BadRequestException;

import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Random;


public class ProvablyFairProvider {
    private final SecureRandom random;

    public ProvablyFairProvider() {
        random = new SecureRandom();
    }

    static private final int SEED_RAW_LENGTH = 32;
    static public final int SEED_LENGTH = 2 * SEED_RAW_LENGTH;

    static private final int HASH_RAW_LENGTH = 32;
    static public final int HASH_LENGTH = 2 * HASH_RAW_LENGTH;

    static public final int FAIR_RANDOM_TOKEN_LENGTH = HASH_RAW_LENGTH;

    public String generateSeed() {
        byte[] rawSeed = new byte[SEED_RAW_LENGTH];
        random.nextBytes(rawSeed);

        return HexFormat.of().formatHex(rawSeed);
    }

    public String generateHash(String seed) {
        byte[] rawSeed = HexFormat.of().parseHex(seed);

        byte[] rawHash = sha256().digest(rawSeed);

        return HexFormat.of().formatHex(rawHash);
    }

    public Random fairRandom(String serverSeed, String clientSeed) {
        byte[] serverRawSeed = HexFormat.of().parseHex(serverSeed);

        if (clientSeed.length() != SEED_LENGTH) {
            throw new BadRequestException("invalid seed");
        }

        byte[] clientRawSeed;
        try {
            clientRawSeed = HexFormat.of().parseHex(clientSeed);
        }
        catch (IllegalArgumentException e) {
            throw new BadRequestException("invalid seed");
        }

        byte[] combined = new byte[serverRawSeed.length + clientRawSeed.length];
        System.arraycopy(serverRawSeed, 0, combined, 0, serverRawSeed.length);
        System.arraycopy(clientRawSeed, 0, combined, serverRawSeed.length, clientRawSeed.length);

        byte[] token = sha256().digest(combined);

        long seed = ByteBuffer.wrap(token, 0, 8).getLong();

        return new Random(seed);
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
