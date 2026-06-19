package com.example.phantom.chat.chat;

import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat/chats")
@Validated
public class PersonalChatController {

    private final PersonalChatService personalChatService;

    @PostMapping
    public ChatRepresentation post(@AuthenticationPrincipal Long userId) {
        return personalChatService.post(userId);
    }

    @GetMapping
    public List<ChatRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long beforeTimestamp,
            @RequestParam(required = false) Long beforeId) {
        return personalChatService.get(userId, limit, beforeTimestamp, beforeId);
    }

    @GetMapping("/{chatId}")
    public ChatRepresentation getChat(@AuthenticationPrincipal Long userId, @PathVariable Long chatId) {
        return personalChatService.getChat(userId, chatId);
    }

    @PostMapping("/{chatId}/leave")
    public Void leave(@AuthenticationPrincipal Long userId, @PathVariable Long chatId) {
        return personalChatService.leave(userId, chatId);
    }

    @DeleteMapping("/{chatId}")
    public void delete(@AuthenticationPrincipal Long userId, @PathVariable Long chatId) {
        personalChatService.delete(userId, chatId);
    }

    @PostMapping("/{chatId}/kick/{targetId}")
    public ChatRepresentation kick(@AuthenticationPrincipal Long userId, @PathVariable Long chatId, @PathVariable Long targetId) {
        return personalChatService.kick(userId, chatId, targetId);
    }

    @PostMapping("/{chatId}/add/{targetId}")
    public ChatRepresentation add(@AuthenticationPrincipal Long userId, @PathVariable Long chatId, @PathVariable Long targetId) {
        return personalChatService.add(userId, chatId, targetId);
    }


    public PersonalChatController(PersonalChatService personalChatService) {
        this.personalChatService = personalChatService;
    }
}
