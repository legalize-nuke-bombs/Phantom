package com.example.phantom.usagelimit;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/usage-limit")
public class UsageLimitController {

    private final UsageLimitService service;

    public UsageLimitController(UsageLimitService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<UsageLimitRepresentation> get(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.get(userId));
    }
}
