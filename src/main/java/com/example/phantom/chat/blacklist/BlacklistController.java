package com.example.phantom.chat.blacklist;

import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
@RequestMapping("/api/chat/blacklists")
public class BlacklistController {

    private final BlacklistService blacklistService;

    public BlacklistController(BlacklistService blacklistService) {
        this.blacklistService = blacklistService;
    }

    @GetMapping
    public BlacklistRepresentation get(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return blacklistService.get(userId, limit, before);
    }

    @PostMapping("/{targetId}")
    public Void post(@AuthenticationPrincipal Long userId, @PathVariable Long targetId) {
        return blacklistService.post(userId, targetId);
    }

    @DeleteMapping("/{targetId}")
    public void delete(@AuthenticationPrincipal Long userId, @PathVariable Long targetId) {
        blacklistService.delete(userId, targetId);
    }
}
