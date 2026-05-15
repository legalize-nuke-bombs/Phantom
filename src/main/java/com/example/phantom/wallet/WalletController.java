package com.example.phantom.wallet;

import com.example.phantom.wallet.balancechange.BalanceChangeRepresentation;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/wallets")
public class WalletController {

    private final WalletService walletService;

    public WalletController(WalletService walletService) {
        this.walletService = walletService;
    }

    @GetMapping("/{targetId}")
    public ResponseEntity<WalletRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId) {
        return ResponseEntity.ok(walletService.get(userId, targetId));
    }

    @GetMapping("/{targetId}/history")
    public ResponseEntity<List<BalanceChangeRepresentation>> getHistory(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId,
            @RequestParam @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(walletService.getHistory(userId, targetId, limit, before));
    }

    @GetMapping("/stats")
    public ResponseEntity<PlatformWalletStatRepresentation> stats() {
        return ResponseEntity.ok(walletService.getStats());
    }

    @GetMapping("/{targetId}/stats")
    public ResponseEntity<PersonalWalletStatRepresentation> stats(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId) {
        return ResponseEntity.ok(walletService.getStats(userId, targetId));
    }
}
