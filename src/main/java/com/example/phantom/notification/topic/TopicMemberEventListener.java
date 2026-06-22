package com.example.phantom.notification.topic;

import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class TopicMemberEventListener {

    private final ApplicationEventPublisher applicationEventPublisher;

    public TopicMemberEventListener(ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @PreRemove
    public void preRemove(TopicMember topicMember) {
        applicationEventPublisher.publishEvent(new TopicMemberPreRemoveEvent(topicMember));
    }

    @PreUpdate
    public void preUpdate(TopicMember topicMember) {
        applicationEventPublisher.publishEvent(new TopicMemberPreUpdateEvent(topicMember));
    }
}
