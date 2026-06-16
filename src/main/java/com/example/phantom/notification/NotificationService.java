package com.example.phantom.notification;

import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final RateLimitService rateLimitService;

    public NotificationService(NotificationRepository notificationRepository, RateLimitService rateLimitService) {
        this.notificationRepository = notificationRepository;
        this.rateLimitService = rateLimitService;
    }

    public List<NotificationRepresentation> get(Long userId, Long before, Integer limit) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);
        List<Notification> notifications = notificationRepository.findByDestinationTypeDestinationUserId(NotificationDestinationType.USER, userId, before, pageable);
        return notifications.stream().map(NotificationRepresentation::new).toList();
    }
}
