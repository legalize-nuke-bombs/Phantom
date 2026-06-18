package com.example.phantom.chat.chat;

import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat/chats")
@Validated
public class ChatController {

    private final ChatService chatService;

    @PostMapping
    public ChatRepresentation post(@AuthenticationPrincipal Long userId) {
        return chatService.post(userId);
    }

    @GetMapping
    public List<ChatRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before) {
        return chatService.get(userId, limit, before);
    }

    @GetMapping("/{chatId}")
    public ChatRepresentation getChat(@AuthenticationPrincipal Long userId, @PathVariable Long chatId) {
        return chatService.getChat(userId, chatId);
    }

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }
}
