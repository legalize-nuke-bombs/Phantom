package com.example.phantom.chat.stat;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/chat/stats")
public class ChatStatController {

    private final ChatPlatformStatService chatStatService;

    public ChatStatController(ChatPlatformStatService chatStatService) {
        this.chatStatService = chatStatService;
    }

    @GetMapping("/platform")
    public ChatPlatformStatRepresentation getPlatform() {
        return chatStatService.get();
    }
}
