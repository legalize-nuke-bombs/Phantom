package com.example.phantom.chat.chat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat/chats")
@Validated
public class PersonalChatController {

    private final PersonalChatService personalChatService;

    @PostMapping
    public ChatRepresentation post(
            @AuthenticationPrincipal Long userId,
            @RequestBody @Valid PostChatRequest request) {
        return personalChatService.post(userId, request);
    }

    @GetMapping
    public List<ChatRepresentation> get(
            @AuthenticationPrincipal Long userId) {
        return personalChatService.get(userId);
    }

    @GetMapping("/{chatId}")
    public ChatRepresentation getChat(@AuthenticationPrincipal Long userId, @PathVariable UUID chatId) {
        return personalChatService.getChat(userId, chatId);
    }

    @GetMapping("/favourite")
    public ChatRepresentation getFavoriteChat(@AuthenticationPrincipal Long userId) {
        return personalChatService.getFavoriteChat(userId);
    }

    @GetMapping("/p2/{targetId}")
    public ChatRepresentation getP2Chat(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId) {
        return personalChatService.getP2Chat(userId, targetId);
    }

    @PostMapping("/{chatId}/leave")
    public Void leave(@AuthenticationPrincipal Long userId, @PathVariable UUID chatId) {
        return personalChatService.leave(userId, chatId);
    }

    @DeleteMapping("/{chatId}")
    public void delete(@AuthenticationPrincipal Long userId, @PathVariable UUID chatId) {
        personalChatService.delete(userId, chatId);
    }

    @PostMapping("/{chatId}/kick/{targetId}")
    public ChatRepresentation kick(@AuthenticationPrincipal Long userId, @PathVariable UUID chatId, @PathVariable Long targetId) {
        return personalChatService.kick(userId, chatId, targetId);
    }

    @PostMapping("/{chatId}/add/{targetId}")
    public ChatRepresentation add(@AuthenticationPrincipal Long userId, @PathVariable UUID chatId, @PathVariable Long targetId) {
        return personalChatService.add(userId, chatId, targetId);
    }


    public PersonalChatController(PersonalChatService personalChatService) {
        this.personalChatService = personalChatService;
    }
}
