package com.example.phantom.game.upgrader;

import com.example.phantom.game.GameInitRepresentation;
import com.example.phantom.game.GameInitRequest;
import com.example.phantom.game.GameRepresentation;
import com.example.phantom.game.GameRunRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Validated
@RequestMapping("/api/games/upgrader")
public class UpgraderController {

    private final UpgraderService upgraderService;

    public UpgraderController(UpgraderService upgraderService) {
        this.upgraderService = upgraderService;
    }

    @GetMapping
    public ResponseEntity<UpgraderSettings> get() {
        return ResponseEntity.ok(upgraderService.get());
    }

    @PostMapping("/init")
    public ResponseEntity<GameInitRepresentation> init(@AuthenticationPrincipal Long userId, @Valid @RequestBody GameInitRequest request) {
        return ResponseEntity.ok(upgraderService.init(userId, request));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long userId) {
        upgraderService.delete(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/run")
    public ResponseEntity<GameRepresentation> run(@AuthenticationPrincipal Long userId, @Valid @RequestBody GameRunRequest request) {
        return ResponseEntity.ok(upgraderService.run(userId, request));
    }

    @GetMapping("/history")
    public ResponseEntity<List<GameRepresentation>> getHistory(@AuthenticationPrincipal Long userId,
                                                               @RequestParam(defaultValue = "20") @Min(1) Integer limit,
                                                               @RequestParam(required = false) Long before) {
        return ResponseEntity.ok(upgraderService.getHistory(userId, limit, before));
    }
}
