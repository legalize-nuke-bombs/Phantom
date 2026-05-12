package com.example.phantom.stat;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stats")
public class StatController {

    private final StatService service;

    public StatController(StatService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PlatformStatRepresentation> get() {
        return ResponseEntity.ok(service.get());
    }

    @GetMapping("/me")
    public ResponseEntity<PersonalStatRepresentation> getMe(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.getByUserId(userId));
    }
}
