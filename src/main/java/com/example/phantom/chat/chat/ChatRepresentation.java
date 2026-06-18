package com.example.phantom.chat.chat;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

import java.util.List;

@Getter
public class ChatRepresentation {
    private final Long id;
    private final String topicId;
    private final Long timestamp;
    private final List<UserShortRepresentation> members;

    public ChatRepresentation(Chat chat, List<UserShortRepresentation> members) {
        this.id = chat.getId();
        this.topicId = chat.getTopic().getId();
        this.timestamp = chat.getTopic().getTimestamp();
        this.members = members;
    }
}
