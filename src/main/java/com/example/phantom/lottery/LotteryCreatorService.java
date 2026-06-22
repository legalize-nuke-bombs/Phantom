package com.example.phantom.lottery;

import com.example.phantom.provablyfair.ProvablyFairService;
import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;

@Service
@Slf4j
public class LotteryCreatorService {

    private final LotteryRepository lotteryRepository;
    private final ProvablyFairService provablyFairService;

    private final BigDecimal ticketCost;
    private final Long timestampEnd;
    private final Long timestampBlock;
    private final Long timestampNotificationEnding;

    public LotteryCreatorService(LotteryRepository lotteryRepository, ProvablyFairService provablyFairService,
                                 @Value("${lottery.ticket-cost}") @NotNull BigDecimal ticketCost,
                                 @Value("${lottery.timestamp-end}") @NotNull Long timestampEnd,
                                 @Value("${lottery.timestamp-block}") @NotNull Long timestampBlock,
                                 @Value("${lottery.timestamp-notification-ending}") @NotNull Long timestampNotificationEnding) {

        if (ticketCost.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("malformed ticket cost");
        }
        if (!(0 <= timestampNotificationEnding && timestampNotificationEnding <= timestampBlock && timestampBlock <= timestampEnd)) {
            throw new IllegalArgumentException("malformed timestamps");
        }

        this.lotteryRepository = lotteryRepository;
        this.provablyFairService = provablyFairService;

        this.ticketCost = ticketCost;
        this.timestampEnd = timestampEnd;
        this.timestampBlock = timestampBlock;
        this.timestampNotificationEnding = timestampNotificationEnding;
        log.info("initialization ticketCost {} timestampEnd {} timestampBlock {} timestampNotificationEnding {}", ticketCost, timestampEnd, timestampBlock, timestampNotificationEnding);
    }

    @Transactional
    public Lottery createNewLottery() {
        log.info("creating new lottery...");

        Lottery lottery = new Lottery();

        lottery.setTimestamp(Instant.now().getEpochSecond());
        lottery.setTimestampNotificationEnding(lottery.getTimestamp() + timestampNotificationEnding);
        lottery.setNotificationEndingFired(false);
        lottery.setTimestampBlock(lottery.getTimestamp() + timestampBlock);
        lottery.setTimestampEnd(lottery.getTimestamp() + timestampEnd);

        lottery.setTicketCost(ticketCost);

        lottery.setSeed1(provablyFairService.generateSeed());
        lottery.setSeed2(provablyFairService.generateSeed());

        lottery = lotteryRepository.save(lottery);
        log.info("new lottery created");
        return lottery;
    }
}
