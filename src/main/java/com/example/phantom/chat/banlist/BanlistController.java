package com.example.phantom.chat.banlist;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/chat/banlist")
public class BanlistController {

    private final BanlistService service;

    public BanlistController(BanlistService service) {
        this.service = service;
    }

    @GetMapping("/me")
    public ResponseEntity<BanRepresentation> getMe(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.getById(userId));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<BanRepresentation> getById(@PathVariable Long userId) {
        return ResponseEntity.ok(service.getById(userId));
    }

    @PostMapping("/{targetId}")
    public ResponseEntity<Map<String, String>> ban(@AuthenticationPrincipal Long userId, @PathVariable Long targetId, @Valid @RequestBody BanRequest request) {
        return ResponseEntity.ok(service.ban(userId, targetId, request));
    }

    @DeleteMapping("/{targetId}")
    public ResponseEntity<Void> unban(@AuthenticationPrincipal Long userId, @PathVariable Long targetId, @Valid @RequestBody UnbanRequest request) {
        service.unban(userId, targetId, request);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
