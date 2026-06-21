package com.example.phantom.notification.topic;


import com.example.phantom.notification.WebSocketSessionManager;
import com.example.phantom.user.UserPreRemoveEvent;
import com.example.phantom.user.UserPreUpdateEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class TopicAccessRevalidationService {

    private final WebSocketSessionManager webSocketSessionManager;

    public TopicAccessRevalidationService(WebSocketSessionManager webSocketSessionManager) {
        this.webSocketSessionManager = webSocketSessionManager;
    }

    public void revalidate(Long userId) {
        log.info("revalidation user {}", userId);
        webSocketSessionManager.kickUser(userId);
    }


    @EventListener(TopicMemberPreRemoveEvent.class)
    public void beforeDelete(TopicMemberPreRemoveEvent event) {
        Long userId = event.topicMember().getUser().getId();
        log.info("revalidation on topic member pre remove user {}", userId);
        revalidate(userId);
    }

    @EventListener(TopicMemberPreUpdateEvent.class)
    public void beforeUpdate(TopicMemberPreUpdateEvent event) {
        Long userId = event.topicMember().getUser().getId();
        log.info("revalidation on topic member pre update user {}", userId);
        revalidate(userId);
    }


    @EventListener(UserPreUpdateEvent.class)
    public void beforeUpdate(UserPreUpdateEvent event) {
        Long userId = event.user().getId();
        log.info("revalidation on user pre update user {}", userId);
        revalidate(userId);
    }

    @EventListener(UserPreRemoveEvent.class)
    public void beforeDelete(UserPreRemoveEvent event) {
        Long userId = event.user().getId();
        log.info("revalidation on user pre remove user {}", userId);
        revalidate(userId);
    }
}
