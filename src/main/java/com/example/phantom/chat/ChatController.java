package com.example.phantom.chat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService service;

    public ChatController(ChatService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<MessageRepresentation>> get(@AuthenticationPrincipal Long userId,
                                                           @RequestParam(defaultValue = "20") @Min(1) Integer limit,
                                                           @RequestParam(required = false) Long before) {
        return ResponseEntity.ok(service.get(userId, limit, before));
    }

    @PostMapping
    public ResponseEntity<MessageRepresentation> sendMessage(@AuthenticationPrincipal Long userId, @Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(service.sendMessage(userId, request));
    }

    @DeleteMapping("/{messageId}")
    public ResponseEntity<Void> deleteMessage(@AuthenticationPrincipal Long userId, @PathVariable Long messageId) {
        service.deleteMessage(userId, messageId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
