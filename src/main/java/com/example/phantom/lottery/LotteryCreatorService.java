package com.example.phantom.lottery;

import com.example.phantom.provablyfair.ProvablyFairService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@Slf4j
public class LotteryCreatorService {

    private final LotteryRepository lotteryRepository;
    private final LotteryCreatorSettings lotteryCreatorSettings;
    private final ProvablyFairService provablyFairService;

    public LotteryCreatorService(LotteryRepository lotteryRepository, LotteryCreatorSettings lotteryCreatorSettings, ProvablyFairService provablyFairService) {
        this.lotteryRepository = lotteryRepository;
        this.lotteryCreatorSettings = lotteryCreatorSettings;
        this.provablyFairService = provablyFairService;
    }

    @Transactional
    public Lottery createNewLottery() {
        log.info("creating new lottery...");

        Lottery lottery = new Lottery();

        lottery.setTimestamp(Instant.now().getEpochSecond());
        lottery.setTimestampNotificationEnding(lottery.getTimestamp() + lotteryCreatorSettings.getNotificationEnding());
        lottery.setNotificationEndingFired(false);
        lottery.setTimestampBlock(lottery.getTimestamp() + lotteryCreatorSettings.getBlock());
        lottery.setTimestampEnd(lottery.getTimestamp() + lotteryCreatorSettings.getEnd());

        lottery.setTicketCost(lotteryCreatorSettings.getTicketCost());

        lottery.setSeed1(provablyFairService.generateSeed());
        lottery.setSeed2(provablyFairService.generateSeed());

        lottery = lotteryRepository.save(lottery);
        log.info("new lottery created");
        return lottery;
    }
}
