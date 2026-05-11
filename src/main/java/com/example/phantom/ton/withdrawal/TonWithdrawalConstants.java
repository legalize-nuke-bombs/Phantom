package com.example.phantom.ton.withdrawal;

import java.math.BigDecimal;

public class TonWithdrawalConstants {
    public static final int MIN = 1;
    public static final BigDecimal COMMISSION = new BigDecimal("0.1");
    public static final long VALIDATION_DURATION = 10 * 60;

    private TonWithdrawalConstants() {}
}
