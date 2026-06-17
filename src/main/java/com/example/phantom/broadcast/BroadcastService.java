package com.example.phantom.broadcast;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.notification.topic.Topic;
import com.example.phantom.notification.topic.globaltopic.GlobalTopicService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class BroadcastService {

    private final UserRepository userRepository;
    private final GlobalTopicService globalTopicService;
    private final NotificationPublishService notificationPublishService;

    public BroadcastService(UserRepository userRepository, GlobalTopicService globalTopicService, NotificationPublishService notificationPublishService) {
        this.userRepository = userRepository;
        this.globalTopicService = globalTopicService;
        this.notificationPublishService = notificationPublishService;
    }

    @Transactional
    public Void post(Long userId, BroadcastRequest request) {
        User user = getChatModerator(userId);
        Topic topic = globalTopicService.findAuthorized();

        notificationPublishService.createTopicNotification(topic, NotificationType.BROADCAST, new BroadcastRepresentation(user, request.getContent()));

        log.info("user {} broadcasted", userId);
        return null;
    }

    private User getChatModerator(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        if (!user.getRole().getChatModeratorAccess()) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return user;
    }
}
