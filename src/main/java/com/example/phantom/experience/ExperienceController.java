package com.example.phantom.experience;

import com.example.phantom.experience.experiencechange.ExperienceChangeRepresentation;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/experience")
public class ExperienceController {

    private final ExperienceService service;

    public ExperienceController(ExperienceService service) {
        this.service = service;
    }

    @GetMapping("/levels")
    public ResponseEntity<List<LevelRepresentation>> getLevels() {
        return ResponseEntity.ok(service.getLevels());
    };

    @GetMapping("/{targetId}")
    public ResponseEntity<ExperienceRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId
    ) {
        return ResponseEntity.ok(service.get(userId, targetId));
    }

    @GetMapping("/{targetId}/history")
    public ResponseEntity<List<ExperienceChangeRepresentation>> getHistory(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId,
            @RequestParam @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(service.getHistory(userId, targetId, limit, before));
    }
}
