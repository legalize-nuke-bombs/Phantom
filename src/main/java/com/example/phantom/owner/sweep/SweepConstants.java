package com.example.phantom.owner.sweep;

import java.math.BigDecimal;

public class SweepConstants {
    public static final long MIN_DELAY = 60;
    public static final long MAX_DELAY = 60 * 60 * 24 * 365;

    public static final int COIN_MAX_LENGTH = 20;
    public static final int SENDER_MAX_LENGTH = 100;
    public static final int RECEIVER_MAX_LENGTH = 100;
    public static final int STATUS_MAX_LENGTH = 20;

    public static final BigDecimal MIN_SWEEP_FOR_TON = new BigDecimal("0.1");

    private SweepConstants() {}
}
