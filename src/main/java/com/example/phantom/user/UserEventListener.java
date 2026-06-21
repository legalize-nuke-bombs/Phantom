package com.example.phantom.user;

import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class UserEventListener {

    private static ApplicationEventPublisher applicationEventPublisher;

    // IMPORTANT: constructor for Hibernate, NO SPRING BEAN
    public UserEventListener() {
    }


    @Autowired
    public void init(ApplicationEventPublisher applicationEventPublisher) {
        UserEventListener.applicationEventPublisher = applicationEventPublisher;
    }

    @PreRemove
    public void preRemove(User user) {
        applicationEventPublisher.publishEvent(new UserPreRemoveEvent(user));
    }

    @PreUpdate
    public void preUpdate(User user) {
        applicationEventPublisher.publishEvent(new UserPreUpdateEvent(user));
    }
}
