package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.profile.ProfileCardRepresentation;
import lombok.Getter;
import java.util.Map;

@Getter
public class ChatModeratorActionRepresentation {
    private final Long id;
    private final ProfileCardRepresentation profileCard;
    private final Long timestamp;
    private final ChatModeratorActionType type;
    private final Map<String, String> data;

    public ChatModeratorActionRepresentation(ChatModeratorAction chatModeratorAction, ProfileCardRepresentation profileCard) {
        this.id = chatModeratorAction.getId();
        this.profileCard = profileCard;
        this.timestamp = chatModeratorAction.getTimestamp();
        this.type = chatModeratorAction.getType();
        this.data = chatModeratorAction.getData();
    }
}
