package com.example.phantom.ton;

import java.math.BigDecimal;

public class TonConstants {
    public static final BigDecimal NANOTON = new BigDecimal("1000000000");
    public static final long WALLET_ID_V5 = 2147483409L;

    public static final int ADDRESS_LENGTH = 48;
    public static final String ADDRESS_PATTERN = "^(EQ|UQ)[A-Za-z0-9_-]{46}$";
    public static final int MNEMONIC_MAX_LENGTH = 300;
    public static final int PRIVATE_KEY_HEX_LENGTH = 64;
    public static final int TX_HASH_MAX_LENGTH = 128;

    public static final int WALLET_VERSION_MAX_LENGTH = 10;
    public static final int TRANSFER_STATUS_MAX_LENGTH = 10;

    private TonConstants() {}
}
