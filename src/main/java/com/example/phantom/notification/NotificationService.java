package com.example.phantom.notification;

import com.example.phantom.notification.topic.TopicService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    private final TopicService topicService;
    private final NotificationRepository notificationRepository;
    private final RateLimitService rateLimitService;

    public NotificationService(TopicService topicService, NotificationRepository notificationRepository, RateLimitService rateLimitService) {
        this.topicService = topicService;
        this.notificationRepository = notificationRepository;
        this.rateLimitService = rateLimitService;
    }

    public List<NotificationRepresentation> get(Long userId, Long before, Integer limit) {
        List<String> accessibleTopicIds = topicService.get(userId);

        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);
        List<Notification> notifications = notificationRepository.findRelevant(
                NotificationDestinationType.USER,
                NotificationDestinationType.TOPIC,
                userId,
                accessibleTopicIds,
                before,
                pageable
        );
        return notifications.stream().map(NotificationRepresentation::new).toList();
    }
}
