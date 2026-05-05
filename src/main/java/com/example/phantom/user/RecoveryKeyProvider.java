package com.example.phantom.user;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.HexFormat;

@Component
public class RecoveryKeyProvider {
    private final SecureRandom random;

    public static final int RECOVERY_KEY_PART_RAW_LENGTH = 32;
    public static final int RECOVERY_KEY_PART_LENGTH = 2 * RECOVERY_KEY_PART_RAW_LENGTH;

    public RecoveryKeyProvider() {
        this.random = new SecureRandom();
    }

    public String generatePart() {
        byte[] rawSeed = new byte[RECOVERY_KEY_PART_RAW_LENGTH];
        random.nextBytes(rawSeed);

        return HexFormat.of().formatHex(rawSeed);
    }
}
