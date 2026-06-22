package com.example.phantom.user;

import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class UserEventListener {

    private final ApplicationEventPublisher applicationEventPublisher;

    public UserEventListener(ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
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
