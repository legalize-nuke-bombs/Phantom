package com.example.phantom.chat;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

@Getter
public class MessageRepresentation {
    private final Long id;
    private final UserShortRepresentation user;
    private final Long timestamp;
    private final String content;

    public MessageRepresentation(Message message) {
        this.id = message.getId();
        this.user = new UserShortRepresentation(message.getUser());
        this.timestamp = message.getTimestamp();
        this.content = message.getContent();
    }
}
