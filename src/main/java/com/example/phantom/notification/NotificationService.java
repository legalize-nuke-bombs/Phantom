package com.example.phantom.notification;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.topic.TopicService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Slf4j
public class NotificationService {

    private final UserRepository userRepository;
    private final TopicService topicService;
    private final NotificationRepository notificationRepository;
    private final ReadNotificationRepository readNotificationRepository;
    private final RateLimitService rateLimitService;

    private static final int MAX_NOTIFICATIONS = 100000;

    public NotificationService(UserRepository userRepository, TopicService topicService, NotificationRepository notificationRepository, ReadNotificationRepository readNotificationRepository, RateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.topicService = topicService;
        this.notificationRepository = notificationRepository;
        this.readNotificationRepository = readNotificationRepository;
        this.rateLimitService = rateLimitService;
    }

    public List<NotificationRepresentation> get(Long userId, Boolean notReadOnly, Long before, Integer limit) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);
        List<Notification> notifications = notificationRepository.findRelevant(
                NotificationDestinationType.USER,
                NotificationDestinationType.TOPIC,
                notReadOnly,
                userId,
                topicService.get(userId),
                before,
                pageable
        );
        return notifications.stream().map(NotificationRepresentation::new).toList();
    }

    public Void read(Long userId, ReadNotificationsRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        List<Long> ids = request.getIds();
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, ids.size());

        List<Notification> notifications = notificationRepository.findAllById(ids);

        long skipped = 0, ok = 0;
        for (Notification notification : notifications) {
            try {
                ReadNotification readNotification = new ReadNotification();
                readNotification.setNotification(notification);
                readNotification.setUser(user);
                readNotificationRepository.save(readNotification);
                ok++;
            }
            catch (DataIntegrityViolationException e) {
                skipped++;
            }
        }

        log.info("user {} requested to mark {} notifications as read, skipped {}, marked {}", userId, notifications.size(), skipped, ok);
        return null;
    }

    @Scheduled(fixedDelay = 5L * 60 * 1000)
    @Transactional
    public void cleaningOld() {
        long count = notificationRepository.count();
        log.info("found {} notifications", count);

        if (count >= MAX_NOTIFICATIONS) {
            List<Notification> oldest = notificationRepository.findOldest(PageRequest.of(0, (int)(count / 2)));
            log.info("{} notifications will be deleted", oldest.size());
            notificationRepository.deleteAll(oldest);
            log.info("cleaning done");
        }
        else {
            log.info("cleaning skipped: max number of notifications set as {}", MAX_NOTIFICATIONS);
        }
    }
}
