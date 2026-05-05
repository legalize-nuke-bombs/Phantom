package com.example.phantom.game.util;

import lombok.Getter;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Getter
@Component
public class FinanceColors {
    private final BigDecimal grey = new BigDecimal(0);
    private final BigDecimal blue = new BigDecimal("0.1");
    private final BigDecimal purple = new BigDecimal(1);
    private final BigDecimal pink = new BigDecimal(15);
    private final BigDecimal red = new BigDecimal(50);
    private final BigDecimal gold = new BigDecimal(100);
}
