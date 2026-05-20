package com.example.phantom.lottery;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class LotteryInitializer {
    private final LotteryService service;

    public LotteryInitializer(LotteryService service) {
        this.service = service;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void init() {
        service.ensureLotteryExist();
    }
}
