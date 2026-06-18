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
            @RequestParam(required = false) Long beforeTimestamp,
            @RequestParam(required = false) Long beforeId) {
        return chatService.get(userId, limit, beforeTimestamp, beforeId);
    }

    @GetMapping("/{chatId}")
    public ChatRepresentation getChat(@AuthenticationPrincipal Long userId, @PathVariable Long chatId) {
        return chatService.getChat(userId, chatId);
    }

    @PostMapping("/{chatId}/leave")
    public Void leave(@AuthenticationPrincipal Long userId, @PathVariable Long chatId) {
        return chatService.leave(userId, chatId);
    }

    @DeleteMapping("/{chatId}")
    public void delete(@AuthenticationPrincipal Long userId, @PathVariable Long chatId) {
        chatService.delete(userId, chatId);
    }

    @PostMapping("/{chatId}/kick/{targetId}")
    public ChatRepresentation kick(@AuthenticationPrincipal Long userId, @PathVariable Long chatId, @PathVariable Long targetId) {
        return chatService.kick(userId, chatId, targetId);
    }

    @PostMapping("/{chatId}/add/{targetId}")
    public ChatRepresentation add(@AuthenticationPrincipal Long userId, @PathVariable Long chatId, @PathVariable Long targetId) {
        return chatService.add(userId, chatId, targetId);
    }


    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }
}
