package com.example.phantom.notification.topic;

import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class TopicMemberEventListener {

    private static ApplicationEventPublisher applicationEventPublisher;

    // IMPORTANT: constructor for Hibernate, NO SPRING BEAN
    public TopicMemberEventListener() {
    }


    @Autowired
    public void init(ApplicationEventPublisher applicationEventPublisher) {
         TopicMemberEventListener.applicationEventPublisher = applicationEventPublisher;
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
