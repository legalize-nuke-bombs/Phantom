package com.example.phantom.chat;

import com.example.phantom.profile.ProfileCardRepresentation;
import lombok.Getter;

@Getter
public class MessageRepresentation {
    private final Long id;
    private final ProfileCardRepresentation profileCard;
    private final Long timestamp;
    private final String content;

    public MessageRepresentation(Message message, ProfileCardRepresentation profileCard) {
        this.id = message.getId();
        this.profileCard = profileCard;
        this.timestamp = message.getTimestamp();
        this.content = message.getContent();
    }
}
