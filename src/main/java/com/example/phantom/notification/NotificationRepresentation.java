package com.example.phantom.notification;

import lombok.Getter;

import java.time.Instant;

@Getter
public class NotificationRepresentation {

    private final Long id;
    private final Long timestamp;
    private final NotificationType type;
    private final Object payload;

    public NotificationRepresentation(Notification notification) {
        this.id = notification.getId();
        this.timestamp = notification.getTimestamp();
        this.type = notification.getType();
        this.payload = notification.getPayload();
    }
}
