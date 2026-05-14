package com.example.phantom.game;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;

@RestController
@RequestMapping("/api/games")
public class GameController {

    private final GameRepository gameRepository;

    public GameController(GameRepository gameRepository) {
        this.gameRepository = gameRepository;
    }

    @GetMapping("/stats")
    public ResponseEntity<PlatformGameStatRepresentation> stats() {
        long since24h = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();
        return ResponseEntity.ok(new PlatformGameStatRepresentation(
                gameRepository.countCompleted(),
                gameRepository.countCompletedSince(since24h),
                gameRepository.maxResult(),
                gameRepository.maxResultSince(since24h)
        ));
    }

    @GetMapping("/stats/me")
    public ResponseEntity<PersonalGameStatRepresentation> myStats(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(new PersonalGameStatRepresentation(
                gameRepository.countCompletedByUserId(userId),
                gameRepository.maxResultByUserId(userId)
        ));
    }
}
