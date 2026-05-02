package com.example.phantom.wallet;

public class WalletConstants {
    public static final int WITHDRAW_MINIMAL_VALUE = 10;
    public static final int WITHDRAW_COMMISSION = 4;

    public static final int ADDRESS_LENGTH = 34;
    public static final String ADDRESS_PATTERN = "^T[a-zA-Z0-9]{33}$";

    public static final int PRIVATE_KEY_LENGTH = 64;

    private WalletConstants() {}
}
