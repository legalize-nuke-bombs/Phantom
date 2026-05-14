package com.example.phantom.game;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class GameStatService {

    private final GameRepository gameRoundRepository;

    public GameStatService(GameRepository gameRoundRepository) {
        this.gameRoundRepository = gameRoundRepository;
    }

    public PlatformGameStatRepresentation getStats() {
        long since24h = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();
        return new PlatformGameStatRepresentation(
                gameRoundRepository.countCompleted(),
                gameRoundRepository.countCompletedSince(since24h),
                gameRoundRepository.maxResult(),
                gameRoundRepository.maxResultSince(since24h)
        );
    }

    public PersonalGameStatRepresentation getMyStats(Long userId) {
        return new PersonalGameStatRepresentation(
                gameRoundRepository.countCompletedByUserId(userId),
                gameRoundRepository.maxResultByUserId(userId)
        );
    }
}
