package com.example.phantom.game;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.game.upgrader.UpgraderSettings;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@Validated
@RequestMapping("/api/games")
public class GameController {

    private final GameRepository gameRepository;
    private final Map<GameType, GameService> services;

    public GameController(GameRepository gameRepository, List<GameService> services) {
        this.gameRepository = gameRepository;

        this.services = services.stream().collect(Collectors.toMap(GameService::gameType, Function.identity()));
    }

    @GetMapping("/{game}")
    public ResponseEntity<Map<String, String>> get(
            @PathVariable String game) {
        return ResponseEntity.ok(getService(game).get());
    }

    @PostMapping("/{game}/init")
    public ResponseEntity<GameInitRepresentation> init(
            @AuthenticationPrincipal Long userId,
            @PathVariable String game,
            @Valid @RequestBody GameInitRequest request) {
        return ResponseEntity.ok(getService(game).init(userId, request));
    }

    @DeleteMapping("/{game}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Long userId,
            @PathVariable String game) {
        getService(game).delete(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{game}/run")
    public ResponseEntity<GameRepresentation> run(
            @AuthenticationPrincipal Long userId,
            @PathVariable String game,
            @Valid @RequestBody GameRunRequest request) {
        return ResponseEntity.ok(getService(game).run(userId, request));
    }

    @GetMapping("/{game}/history")
    public ResponseEntity<List<GameRepresentation>> getHistory(@AuthenticationPrincipal Long userId,
                                                               @PathVariable String game,
                                                               @RequestParam(defaultValue = "20") @Min(1) Integer limit,
                                                               @RequestParam(required = false) Long before) {
        return ResponseEntity.ok(getService(game).getHistory(userId, limit, before));
    }

    private GameService getService(String game) {
        try {
            game = game.toUpperCase();
        }
        catch (BadRequestException e) {
            throw new BadRequestException("invalid game type");
        }
        GameService service = services.get(GameType.valueOf(game));
        if (service == null) {
            throw new NotFoundException("game not found");
        }
        return service;
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
