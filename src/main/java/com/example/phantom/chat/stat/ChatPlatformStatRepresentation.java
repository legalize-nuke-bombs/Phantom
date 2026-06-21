package com.example.phantom.chat.stat;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ChatPlatformStatRepresentation {
    private final long chats;
    private final long messages;
}
