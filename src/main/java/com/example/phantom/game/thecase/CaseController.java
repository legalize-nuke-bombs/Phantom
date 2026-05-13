package com.example.phantom.game.thecase;

import com.example.phantom.game.GameInitRepresentation;
import com.example.phantom.game.GameRoundRepresentation;
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
@RequestMapping("/api/games/cases")
public class CaseController {

    private final CaseService caseService;

    public CaseController(CaseService caseService) {
        this.caseService = caseService;
    }

    @GetMapping
    public ResponseEntity<CaseSettings> get() {
        return ResponseEntity.ok(caseService.get());
    }

    @PostMapping("/init")
    public ResponseEntity<GameInitRepresentation> init(@AuthenticationPrincipal Long userId, @Valid @RequestBody CaseInitRequest request) {
        return ResponseEntity.ok(caseService.init(userId, request));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long userId) {
        caseService.delete(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/run")
    public ResponseEntity<GameRoundRepresentation> run(@AuthenticationPrincipal Long userId, @Valid @RequestBody GameRunRequest request) {
        return ResponseEntity.ok(caseService.run(userId, request));
    }

    @GetMapping("/history")
    public ResponseEntity<List<GameRoundRepresentation>> getHistory(@AuthenticationPrincipal Long userId,
                                                                     @RequestParam(defaultValue = "20") @Min(1) Integer limit,
                                                                     @RequestParam(required = false) Long before) {
        return ResponseEntity.ok(caseService.getHistory(userId, limit, before));
    }
}
