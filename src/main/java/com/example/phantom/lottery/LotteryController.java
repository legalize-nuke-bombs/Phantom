package com.example.phantom.lottery;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@Validated
@RequestMapping("/api/lottery")
public class LotteryController {

    private final LotteryService service;

    public LotteryController(LotteryService service) {
        this.service = service;
    }

    @GetMapping("/current")
    public ResponseEntity<CurrentLotteryRepresentation> getCurrent(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.getCurrent(userId));
    }

    @GetMapping("/history")
    public ResponseEntity<List<FinishedLotteryRepresentation>> getHistory(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(service.getHistory(userId, limit, before));
    }

    @PostMapping("/buy-tickets")
    public ResponseEntity<Map<String, String>> buyTickets(@AuthenticationPrincipal Long userId, @Valid@RequestBody LotteryTicketAmountRequest request) {
        return ResponseEntity.ok(service.buyTickets(userId, request));
    }

    @PostMapping("/refund-tickets")
    public ResponseEntity<Map<String, String>> refundTickets(@AuthenticationPrincipal Long userId, @Valid @RequestBody LotteryTicketAmountRequest request) {
        return ResponseEntity.ok(service.refundTickets(userId, request));
    }
}
