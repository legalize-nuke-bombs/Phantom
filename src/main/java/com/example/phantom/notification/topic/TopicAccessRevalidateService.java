package com.example.phantom.notification.topic;


import com.example.phantom.notification.WebSocketSessionManager;
import jakarta.persistence.PreRemove;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class TopicAccessRevalidateService {

    private final WebSocketSessionManager webSocketSessionManager;

    public TopicAccessRevalidateService(WebSocketSessionManager webSocketSessionManager) {
        this.webSocketSessionManager = webSocketSessionManager;
    }

    public void revalidate(Long userId) {
        webSocketSessionManager.kickUser(userId);
    }

    @PreRemove
    public void beforeDelete(TopicMember topicMember) {

        webSocketSessionManager.kickUser(topicMember.getUser().getId());
    }
}
