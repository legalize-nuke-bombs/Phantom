package com.example.phantom.lottery;

import lombok.Getter;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@Getter
public class LotteryCreatorSettings {
    private final BigDecimal ticketCost = BigDecimal.ONE;
    private final Long end = 24 * 3600L;
    private final Long block = end - 5 * 60;
    private final Long notificationEnding = block - 5 * 60;
}
