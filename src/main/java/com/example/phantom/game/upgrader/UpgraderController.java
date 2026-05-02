package com.example.phantom.game.upgrader;

import com.example.phantom.game.util.GameRunRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
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
    public ResponseEntity<UpgraderInitRepresentation> init(@AuthenticationPrincipal Long userId, @Valid @RequestBody UpgraderInitRequest request) {
        return ResponseEntity.ok(upgraderService.init(userId, request));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long userId) {
        upgraderService.delete(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/run")
    public ResponseEntity<UpgraderRunRepresentation> run(@AuthenticationPrincipal Long userId, @Valid @RequestBody GameRunRequest request) {
        return ResponseEntity.ok(upgraderService.run(userId, request));
    }
}
