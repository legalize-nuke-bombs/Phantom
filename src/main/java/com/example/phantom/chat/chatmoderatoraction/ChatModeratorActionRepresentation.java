package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;
import java.util.Map;

@Getter
public class ChatModeratorActionRepresentation {
    private final Long id;
    private final UserShortRepresentation user;
    private final Long timestamp;
    private final ChatModeratorActionType type;
    private final Map<String, String> data;

    public ChatModeratorActionRepresentation(ChatModeratorAction chatModeratorAction, UserShortRepresentation user) {
        this.id = chatModeratorAction.getId();
        this.user = user;
        this.timestamp = chatModeratorAction.getTimestamp();
        this.type = chatModeratorAction.getType();
        this.data = chatModeratorAction.getData();
    }
}
