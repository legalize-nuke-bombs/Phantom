package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.user.UserRepresentation;
import lombok.Getter;
import java.util.Map;

@Getter
public class ChatModeratorActionRepresentation {
    private final Long id;
    private final UserRepresentation user;
    private final Long timestamp;
    private final String action;
    private final Map<String, String> data;

    public ChatModeratorActionRepresentation(ChatModeratorAction chatModeratorAction) {
        this.id = chatModeratorAction.getId();
        if (chatModeratorAction.getUser() == null) this.user = null;
        else this.user = new UserRepresentation(chatModeratorAction.getUser());
        this.timestamp = chatModeratorAction.getTimestamp();
        this.action = chatModeratorAction.getAction();
        this.data = chatModeratorAction.getData();
    }
}
