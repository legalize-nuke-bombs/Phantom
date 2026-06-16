package com.example.phantom.notification;

import com.example.phantom.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Slf4j
public class NotificationPublishService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public NotificationPublishService(NotificationRepository notificationRepository, SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = new ObjectMapper();
    }

    @Transactional
    public void createTopicNotification(String topic, NotificationType type, Object payload) {
        Notification notification = new Notification();
        notification.setPublished(false);
        notification.setDestinationType(NotificationDestinationType.TOPIC);
        notification.setTimestamp(Instant.now().getEpochSecond());
        notification.setType(type);
        notification.setPayload(objectMapper.valueToTree(payload));
        notificationRepository.save(notification);
    }

    @Transactional
    public void createUserNotification(User user, NotificationType type, Object payload) {
        Notification notification = new Notification();
        notification.setPublished(false);
        notification.setDestinationType(NotificationDestinationType.USER);
        notification.setDestinationUser(user);
        notification.setTimestamp(Instant.now().getEpochSecond());
        notification.setType(type);
        notification.setPayload(objectMapper.valueToTree(payload));
        notificationRepository.save(notification);
    }

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void publishNotifications() {
        List<Notification> notifications = notificationRepository.findByPublishedForPessimisticWrite(false);
        for (Notification notification : notifications) {
            try {
                convertAndSend(notification);
                notification.setPublished(true);
            }
            catch (Exception e) {
                log.warn("failed to publish notification", e);
            }
        }
        notificationRepository.saveAll(notifications);
        if (!notifications.isEmpty()) {
            log.info("published {} notifications", notifications.size());
        }
    }

    private void convertAndSend(Notification notification) {
        switch (notification.getDestinationType()) {
            case TOPIC -> {
                // TODO
                messagingTemplate.convertAndSend("/topic/" + "...", new NotificationRepresentation(notification));
            }
            case USER -> {
                messagingTemplate.convertAndSendToUser(String.valueOf(notification.getDestinationUser().getId()), "/queue/notifications", new NotificationRepresentation(notification));
            }
        }
    }
}
