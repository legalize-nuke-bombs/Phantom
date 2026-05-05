package com.example.phantom.chat.chatmoderatoraction;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat/chat-moderator-actions")
public class ChatModeratorActionController {

    private final ChatModeratorActionService service;

    public ChatModeratorActionController(ChatModeratorActionService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ChatModeratorActionRepresentation>> get(
            @RequestParam(defaultValue = "50") @Min(1) @Max(50) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(service.get(limit, before));
    }
}
