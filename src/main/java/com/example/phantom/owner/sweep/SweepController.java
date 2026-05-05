package com.example.phantom.owner.sweep;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/owner/sweep")
public class SweepController {

    private final SweepService service;

    public SweepController(SweepService service) {
        this.service = service;
    }

    @GetMapping("/schedule")
    public ResponseEntity<Map<String, String>> getSchedule(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.getSchedule(userId));
    }

    @PostMapping("/schedule")
    public ResponseEntity<Map<String, String>> setSchedule(@AuthenticationPrincipal Long userId, @Valid @RequestBody  SetScheduleRequest request) {
        return ResponseEntity.ok(service.setSchedule(userId, request));
    }

    @DeleteMapping("/schedule")
    public ResponseEntity<Void> deleteSchedule(@AuthenticationPrincipal Long userId) {
        service.deleteSchedule(userId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
