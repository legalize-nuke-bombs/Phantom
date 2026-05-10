package com.example.phantom.wallet.ton;

import java.math.BigDecimal;

public class TonConstants {
    public static final int ADDRESS_LENGTH = 48;
    public static final String ADDRESS_PATTERN = "^(EQ|UQ)[A-Za-z0-9_-]{46}$";

    public static final int MIN_WITHDRAWAL = 1;
    public static final BigDecimal WITHDRAWAL_COMMISSION = new BigDecimal("0.1");
    public static final long WITHDRAWAL_VALIDATION_DURATION = 10 * 60;

    private TonConstants() {}
}
