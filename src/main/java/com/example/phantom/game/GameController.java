package com.example.phantom.game;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/games")
public class GameController {

    private static final long SECONDS_IN_DAY = 86400;

    private final GameRoundRepository gameRoundRepository;

    public GameController(GameRoundRepository gameRoundRepository) {
        this.gameRoundRepository = gameRoundRepository;
    }

    @GetMapping("/stats")
    public ResponseEntity<PlatformGameStatRepresentation> stats() {
        long since24h = Instant.now().getEpochSecond() - SECONDS_IN_DAY;
        return ResponseEntity.ok(new PlatformGameStatRepresentation(
                gameRoundRepository.countCompleted(),
                gameRoundRepository.countCompletedSince(since24h),
                gameRoundRepository.maxResult(),
                gameRoundRepository.maxResultSince(since24h)
        ));
    }

    @GetMapping("/stats/me")
    public ResponseEntity<PersonalGameStatRepresentation> myStats(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(new PersonalGameStatRepresentation(
                gameRoundRepository.countCompletedByUserId(userId),
                gameRoundRepository.maxResultByUserId(userId)
        ));
    }
}
