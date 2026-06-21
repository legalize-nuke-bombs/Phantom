package com.example.phantom.notification.topic;


import com.example.phantom.notification.WebSocketSessionManager;
import com.example.phantom.user.User;
import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import lombok.extern.slf4j.Slf4j;
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

    @PreRemove
    public void beforeDelete(TopicMember topicMember) {
        Long userId = topicMember.getUser().getId();
        log.info("revalidation on topic member pre remove user {}", userId);
        revalidate(userId);
    }

    @PreRemove
    public void beforeDelete(User user) {
        Long userId = user.getId();
        log.info("revalidation on user pre remove user {}", userId);
        revalidate(userId);
    }

    @PreUpdate
    public void beforeUpdate(TopicMember topicMember) {
        Long userId = topicMember.getUser().getId();
        log.info("revalidation on topic member pre update user {}", userId);
        revalidate(userId);
    }

    @PreUpdate
    public void beforeUpdate(User user) {
        Long userId = user.getId();
        log.info("revalidation on user update user {}", userId);
        revalidate(userId);
    }
}
