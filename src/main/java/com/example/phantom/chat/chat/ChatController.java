package com.example.phantom.chat.chat;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat/chats")
@Validated
public class ChatController {

    private final ChatService chatService;

    @PostMapping
    public ChatRepresentation post(@AuthenticationPrincipal Long userId) {
        return chatService.post(userId);
    }

    @GetMapping("/{chatId}")
    public ChatRepresentation get(@AuthenticationPrincipal Long userId, @PathVariable Long chatId) {
        return chatService.get(userId, chatId);
    }

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }
}
