package com.example.phantom.topic;


import com.example.phantom.user.UserPreRemoveEvent;
import com.example.phantom.user.UserPreUpdateEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@Slf4j
public class TopicAccessRevalidationRequiredDetector {

    private final ApplicationEventPublisher applicationEventPublisher;

    public TopicAccessRevalidationRequiredDetector(ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onTopicMemberRemoved(TopicMemberPreRemoveEvent event) {
        flag(event.topicMember().getUser().getId(), event.topicMember().getTopic().getId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onTopicMemberUpdated(TopicMemberPreUpdateEvent event) {
        flag(event.topicMember().getUser().getId(), event.topicMember().getTopic().getId());
    }


    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserUpdated(UserPreUpdateEvent event) {
        flag(event.user().getId(), null);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onUserRemoved(UserPreRemoveEvent event) {
        flag(event.user().getId(), null);
    }

    private void flag(Long userId, String topicId) {
        log.info("access revalidation required flagged: user {} topic {}", userId, topicId);
        applicationEventPublisher.publishEvent(new TopicAccessRevalidationRequiredEvent(userId, topicId));
    }
}
