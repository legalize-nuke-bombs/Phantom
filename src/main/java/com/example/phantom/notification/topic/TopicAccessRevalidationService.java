package com.example.phantom.notification.topic;


import com.example.phantom.notification.WebSocketSessionManager;
import com.example.phantom.user.UserPreRemoveEvent;
import com.example.phantom.user.UserPreUpdateEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

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


    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onTopicMemberRemoved(TopicMemberPreRemoveEvent event) {
        Long userId = event.topicMember().getUser().getId();
        log.info("revalidation on topic member remove, user {}", userId);
        revalidate(userId);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onTopicMemberUpdated(TopicMemberPreUpdateEvent event) {
        Long userId = event.topicMember().getUser().getId();
        log.info("revalidation on topic member update, user {}", userId);
        revalidate(userId);
    }


    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserUpdated(UserPreUpdateEvent event) {
        Long userId = event.user().getId();
        log.info("revalidation on user update, user {}", userId);
        revalidate(userId);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRemoved(UserPreRemoveEvent event) {
        Long userId = event.user().getId();
        log.info("revalidation on user remove, user {}", userId);
        revalidate(userId);
    }
}
