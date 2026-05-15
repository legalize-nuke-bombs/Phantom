package com.example.phantom.game;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@Validated
@RequestMapping("/api/games")
public class GameController {

    private final GameHistoryStatService gameHistoryStatService;
    private final Map<GameType, GameService> services;

    public GameController(GameHistoryStatService gameHistoryStatService, List<GameService> services) {
        this.gameHistoryStatService = gameHistoryStatService;
        this.services = services.stream().collect(Collectors.toMap(GameService::gameType, Function.identity()));
    }

    @GetMapping("/{game}")
    public ResponseEntity<GameSettings> get(
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

    @GetMapping("/{game}/history/{targetId}")
    public ResponseEntity<List<GameRepresentation>> getGameUserHistory(@AuthenticationPrincipal Long userId,
                                                                       @PathVariable String game,
                                                                       @PathVariable Long targetId,
                                                                       @RequestParam(defaultValue = "20") @Min(1) Integer limit,
                                                                       @RequestParam(required = false) Long before) {
        return ResponseEntity.ok(getService(game).getGameUserHistory(userId, targetId, limit, before));
    }

    @GetMapping("/{game}/stats/{targetId}")
    public ResponseEntity<UserGameStatRepresentation> getGameUserStats(@AuthenticationPrincipal Long userId,
                                                                       @PathVariable String game,
                                                                       @PathVariable Long targetId) {
        return ResponseEntity.ok(getService(game).getGameUserStats(userId, targetId));
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

    @GetMapping("/history/{targetId}")
    public ResponseEntity<List<GameRepresentation>> userHistory(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(gameHistoryStatService.getUserHistory(userId, targetId, limit, before));
    }

    @GetMapping("/history")
    public ResponseEntity<List<GameRepresentation>> platformHistory(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(gameHistoryStatService.getPlatformHistory(userId, limit, before));
    }

    @GetMapping("/stats/{targetId}")
    public ResponseEntity<UserGameStatRepresentation> userStats(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId) {
        return ResponseEntity.ok(gameHistoryStatService.getUserStats(userId, targetId));
    }

    @GetMapping("/stats")
    public ResponseEntity<PlatformGameStatRepresentation> platformStats() {
        return ResponseEntity.ok(gameHistoryStatService.getPlatformStats());
    }
}
