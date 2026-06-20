package com.example.phantom.notification.topic;


import com.example.phantom.notification.WebSocketSessionManager;
import org.springframework.stereotype.Service;

@Service
public class TopicAccessRevalidateService {

    private final WebSocketSessionManager webSocketSessionManager;

    public TopicAccessRevalidateService(WebSocketSessionManager webSocketSessionManager) {
        this.webSocketSessionManager = webSocketSessionManager;
    }

    public void revalidate(Long userId) {
        webSocketSessionManager.kickUser(userId);
    }
}
