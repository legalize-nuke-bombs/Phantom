package com.example.phantom.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
@Slf4j
public class WebSocketSessionManager {

    private final Map<String, WebSocketSession> byId = new ConcurrentHashMap<>();
    private final Map<Long, List<WebSocketSession>> activeSessions = new ConcurrentHashMap<>();

    public void track(WebSocketSession session) {
        byId.put(session.getId(), session);
    }

    public void register(Long userId, String sessionId) {
        WebSocketSession session = byId.get(sessionId);
        if (session == null) {
            log.info("register failed: no tracked ws session {} for user {}", sessionId, userId);
            return;
        }
        activeSessions.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(session);
        log.info("registered ws session {} for user {}", sessionId, userId);
    }

    public void remove(WebSocketSession session) {
        byId.remove(session.getId());
        activeSessions.values().forEach(list -> list.remove(session));
        log.info("cleaned ws session {}", session.getId());
    }

    public void kickUser(Long userId) {
        List<WebSocketSession> sessions = activeSessions.remove(userId);

        if (sessions == null || sessions.isEmpty()) {
            log.info("kick failed: no active ws sessions found for user {}", userId);
            return;
        }

        for (WebSocketSession session : sessions) {
            try {
                if (session.isOpen()) {
                    log.info("forcibly closing ws session {} for user {}", session.getId(), userId);
                    session.close(CloseStatus.POLICY_VIOLATION);
                }
            }
            catch (IOException e) {
                log.error("error while kicking user {} from session {}", userId, session.getId(), e);
            }
        }
    }
}
