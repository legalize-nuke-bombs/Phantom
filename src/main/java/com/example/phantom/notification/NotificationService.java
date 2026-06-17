package com.example.phantom.notification;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final RateLimitService rateLimitService;

    public NotificationService(UserRepository userRepository, NotificationRepository notificationRepository, RateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.rateLimitService = rateLimitService;
    }

    public List<NotificationRepresentation> get(Long userId, Long before, Integer limit) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);
        List<Notification> notifications = notificationRepository.findRelevant(
                NotificationDestinationType.USER,
                NotificationDestinationType.TOPIC,
                userId,
                user.getRole().getChatModeratorAccess(),
                user.getRole().getOwnerAccess(),
                before,
                pageable
        );
        return notifications.stream().map(NotificationRepresentation::new).toList();
    }
}
