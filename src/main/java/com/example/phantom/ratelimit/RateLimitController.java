package com.example.phantom.ratelimit;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rate-limit")
public class RateLimitController {

    private final RateLimitService service;

    public RateLimitController(RateLimitService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<RateLimitRepresentation> get(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.get(userId));
    }
}
