package com.example.phantom.experience;

import com.example.phantom.experience.experiencechange.ExperienceChangeRepresentation;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RestController
@Validated
@RequestMapping("/api/experience")
public class ExperienceController {

    private final ExperienceService service;

    public ExperienceController(ExperienceService service) {
        this.service = service;
    }

    @GetMapping("/levels")
    public ResponseEntity<List<LevelRepresentation>> getLevels() {
        return ResponseEntity.ok(Arrays.stream(Level.values()).map(LevelRepresentation::new).toList());
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
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(service.getHistory(userId, targetId, limit, before));
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<List<LeaderboardEntryRepresentation>> getLeaderboard(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long beforeAmount,
            @RequestParam(required = false) Long beforeUserId
    ) {
        return ResponseEntity.ok(service.getLeaderboard(userId, limit, beforeAmount, beforeUserId));
    }
}
