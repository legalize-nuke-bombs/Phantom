package com.example.phantom.notification;

import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Slf4j
public class NotificationCleanerService {

    private final NotificationRepository notificationRepository;
    private final Long maxHistory;
    private final Long maxDurationD;

    public NotificationCleanerService(NotificationRepository notificationRepository, @Value("${notifications.max-history}") @NotNull Long maxHistory, @Value("${notifications.max-duration-d}") @NotNull Long maxDurationD) {
        this.notificationRepository = notificationRepository;
        this.maxHistory = maxHistory;
        this.maxDurationD = maxDurationD;
        log.info("initialization, maxHistory {} maxDurationD {}", this.maxHistory, this.maxDurationD);
    }

    @Scheduled(fixedDelay = 8L * 3600 * 1000)
    @Transactional
    public void removeExpired() {
        long threshold = Instant.now().minusSeconds(24L * 3600 * maxDurationD).getEpochSecond();
        int deleted = notificationRepository.deleteOlderThan(threshold);
        log.info("expired notification cleaner: deleted {} older than {} d (threshold ts {})", deleted, maxDurationD, threshold);
    }

    @Scheduled(fixedDelay = 60 * 1000)
    @Transactional
    public void maintainLimit() {
        long count = notificationRepository.count();
        if (count < maxHistory) {
            return;
        }
        long keep = maxHistory / 2;
        List<Long> boundary = notificationRepository.findIdsNewestFirst(PageRequest.of((int) keep, 1));
        if (boundary.isEmpty()) {
            return;
        }
        int deleted = notificationRepository.deleteUpToId(boundary.get(0));
        log.info("notification limit maintainer: count {} >= {}, kept newest {}, deleted {}", count, maxHistory, keep, deleted);
    }
}
