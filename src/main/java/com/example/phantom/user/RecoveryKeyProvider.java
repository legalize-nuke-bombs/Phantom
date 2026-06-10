package com.example.phantom.user;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import org.springframework.stereotype.Component;
import java.security.SecureRandom;
import java.util.HexFormat;

@Component
public class RecoveryKeyProvider {
    private final SecureRandom random;

    public record KeyPair(String publicKey, String privateKey) {}

    private static final int RECOVERY_KEY_PART_RAW_LENGTH = 32;
    public static final int RECOVERY_KEY_PART_LENGTH = 2 * RECOVERY_KEY_PART_RAW_LENGTH;

    public static final char SEPARATOR = '.';

    public static final int RECOVERY_KEY_LENGTH = 2 * RECOVERY_KEY_PART_LENGTH + 1;

    public RecoveryKeyProvider() {
        this.random = new SecureRandom();
    }

    public KeyPair generateKeyPair() {
        byte[] rawPart1 = new byte[RECOVERY_KEY_PART_RAW_LENGTH];
        random.nextBytes(rawPart1);

        byte[] rawPart2 = new byte[RECOVERY_KEY_PART_RAW_LENGTH];
        random.nextBytes(rawPart2);

        return new KeyPair(HexFormat.of().formatHex(rawPart1), HexFormat.of().formatHex(rawPart2));
    }

    public String keyPairToRecoveryKey(KeyPair keyPair) {
        String publicKey = keyPair.publicKey();
        String privateKey = keyPair.privateKey();

        if (publicKey == null || publicKey.length() != RECOVERY_KEY_PART_LENGTH) throw new IllegalStateException("malformed recovery key");
        if (privateKey == null || privateKey.length() != RECOVERY_KEY_PART_LENGTH) throw new IllegalStateException("malformed recovery key");

        return publicKey + SEPARATOR + privateKey;
    }

    public KeyPair recoveryKeyToKeyPair(String recoveryKey) {
        if (recoveryKey == null || recoveryKey.length() != RECOVERY_KEY_LENGTH) throw new ApiException(ErrorCode.BAD_RECOVERY_KEY);
        if (recoveryKey.charAt(RECOVERY_KEY_PART_LENGTH) != SEPARATOR) throw new ApiException(ErrorCode.BAD_RECOVERY_KEY);

        String publicKey = recoveryKey.substring(0, RECOVERY_KEY_PART_LENGTH);
        String privateKey = recoveryKey.substring(RECOVERY_KEY_PART_LENGTH + 1);

        return new KeyPair(publicKey, privateKey);
    }
}
