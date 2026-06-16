package com.example.phantom.chat;

import com.example.phantom.disk.FileRepresentation;
import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

@Getter
public class MessageRepresentation {
    private final Long id;
    private final UserShortRepresentation user;
    private final Long timestamp;
    private final String content;
    private final FileRepresentation attachment;

    public MessageRepresentation(Message message) {
        this.id = message.getId();
        this.user = new UserShortRepresentation(message.getUser());
        this.timestamp = message.getTimestamp();
        this.content = message.getContent();
        this.attachment = message.getAttachment() != null ? new FileRepresentation(message.getAttachment()) : null;
    }
}
