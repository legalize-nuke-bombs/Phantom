package com.example.phantom.present;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@Validated
@RequestMapping("/api/presents")
public class PresentController {

    private final PresentService presentService;

    public PresentController(PresentService presentService) {
        this.presentService = presentService;
    }

    @GetMapping
    public List<PresentRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Boolean claimed,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return presentService.get(userId, claimed, limit, before);
    }

    @GetMapping("/count")
    public Map<String, String> count(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Boolean claimed
    ) {
        return presentService.count(userId, claimed);
    }

    @PostMapping("/send")
    public Void send(@AuthenticationPrincipal Long userId, @RequestBody @Valid SendPresentRequest request) {
        return presentService.send(userId, request);
    }

    @PostMapping("/claim")
    public PresentRepresentation claim(@AuthenticationPrincipal Long userId, @RequestBody @Valid ClaimPresentRequest request) {
        return presentService.claim(userId, request);
    }

    @PostMapping("/claim-all")
    public Map<String, String> claimAll(@AuthenticationPrincipal Long userId) {
        return presentService.claimAll(userId);
    }
}
