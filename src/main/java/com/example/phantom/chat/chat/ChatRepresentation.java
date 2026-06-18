package com.example.phantom.chat.chat;

import com.example.phantom.notification.topic.TopicMemberRepresentation;
import lombok.Getter;

import java.util.List;

@Getter
public class ChatRepresentation {
    private final String id;
    private final String topicId;
    private final Long timestamp;
    private final List<TopicMemberRepresentation> members;

    public ChatRepresentation(Chat chat, List<TopicMemberRepresentation> members) {
        this.id = String.valueOf(chat.getId());
        this.topicId = chat.getTopic().getId();
        this.timestamp = chat.getTopic().getTimestamp();
        this.members = members;
    }
}
