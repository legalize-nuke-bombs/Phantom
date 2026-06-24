package com.example.phantom.notification;

import com.example.phantom.topic.TopicAccessRevalidationRequiredEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class WebSocketAccessRevalidationService {
    private final WebSocketSessionManager webSocketSessionManager;

    public WebSocketAccessRevalidationService(WebSocketSessionManager webSocketSessionManager) {
        this.webSocketSessionManager = webSocketSessionManager;
    }

    @EventListener
    public void revalidate(TopicAccessRevalidationRequiredEvent event) {
        Long userId = event.userId();
        log.info("websocket revalidation user {}", userId);
        webSocketSessionManager.kickUser(userId);
    }
}
