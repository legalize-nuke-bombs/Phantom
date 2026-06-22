package com.example.phantom.notification;

import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

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
    public void removeExpired() {
        log.info("remove expired: started");
        Long threshold = Instant.now().minusSeconds(24L * 3600 * maxDurationD).getEpochSecond();
        List<Notification> buffer;
        long deleted = 0, failed = 0;
        while (true) {
            buffer = notificationRepository.findOldest(PageRequest.of(0, 1000));
            long deletedLocal = 0;
            for (Notification n : buffer) {
                if (n.getTimestamp() < threshold) {
                    try {
                        notificationRepository.delete(n);
                        deletedLocal++;
                    }
                    catch (DataIntegrityViolationException e) {
                        failed++;
                    }
                }
                else {
                    break;
                }
            }
            if (deletedLocal == 0) {
                log.info("remove expired: {} deleted, {} failed", deleted, failed);
                break;
            }
            deleted += deletedLocal;
        }
    }

    @Scheduled(fixedDelay = 10L * 60 * 1000)
    public void maintainLimit() {
        long count = notificationRepository.count();
        log.info("maintain limit: found {} notifications", count);

        if (count >= maxHistory) {
            List<Notification> oldest = notificationRepository.findOldest(PageRequest.of(0, (int)(count / 2)));
            log.info("maintain limit: {} notifications will be deleted", oldest.size());
            notificationRepository.deleteAll(oldest);
            log.info("maintain limit: done");
        }
        else {
            log.info("maintain limit: skipped");
        }
    }
}
