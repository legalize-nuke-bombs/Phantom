package com.example.phantom.notification;

import com.example.phantom.notification.topic.Topic;
import com.example.phantom.notification.topic.TopicAccessService;
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
    private final TopicAccessService topicAccessService;
    private final NotificationRepository notificationRepository;
    private final RateLimitService rateLimitService;

    public NotificationService(TopicService topicService, TopicAccessService topicAccessService, NotificationRepository notificationRepository, RateLimitService rateLimitService) {
        this.topicService = topicService;
        this.topicAccessService = topicAccessService;
        this.notificationRepository = notificationRepository;
        this.rateLimitService = rateLimitService;
    }

    public List<NotificationRepresentation> get(Long userId, String topicId, Long before, Integer limit) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);
        List<Notification> notifications = notificationRepository.findRelevant(
                NotificationDestinationType.USER,
                NotificationDestinationType.TOPIC,
                userId,
                topicId == null ? topicService.get(userId) : (topicAccessService.canReadTopic(userId, topicId) ? List.of(topicId) : List.of()),
                before,
                pageable
        );
        return notifications.stream().map(NotificationRepresentation::new).toList();
    }
}
