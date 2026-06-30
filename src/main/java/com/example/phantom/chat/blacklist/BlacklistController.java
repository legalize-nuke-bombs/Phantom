package com.example.phantom.chat.blacklist;

import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat/blacklist")
@Validated
public class BlacklistController {

    private final BlacklistService blacklistService;

    public BlacklistController(BlacklistService blacklistService) {
        this.blacklistService = blacklistService;
    }

    @PostMapping("/{targetId}")
    public BlackRepresentation post(@AuthenticationPrincipal Long userId, @PathVariable Long targetId) {
        return blacklistService.post(userId, targetId);
    }

    @DeleteMapping("/{targetId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long userId, @PathVariable Long targetId) {
        blacklistService.delete(userId, targetId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @GetMapping("/am-i-blocked/{targetId}")
    public BlackRepresentation amIBlocked(@AuthenticationPrincipal Long userId, @PathVariable Long targetId) {
        return blacklistService.amIBlocked(userId, targetId);
    }

    @GetMapping("/is-blocked/{targetId}")
    public BlackRepresentation isBlocked(@AuthenticationPrincipal Long userId, @PathVariable Long targetId) {
        return blacklistService.isBlocked(userId, targetId);
    }

    @GetMapping
    public List<BlackRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit
    ) {
        return blacklistService.get(userId, before, limit);
    }
}
