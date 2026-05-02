package com.example.phantom.wallet;

import com.example.phantom.ratelimit.RateLimiter;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private static final long DEPOSIT_COOLDOWN_MS = 5000;
    private static final long WITHDRAWAL_INIT_COOLDOWN_MS = 10000;
    private static final long WITHDRAWAL_CHECK_COOLDOWN_MS = 5000;

    private final WalletService walletService;
    private final RateLimiter rateLimiter;

    public WalletController(WalletService walletService, RateLimiter rateLimiter) {
        this.walletService = walletService;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping
    public ResponseEntity<WalletRepresentation> get(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(walletService.get(userId));
    }

    @PostMapping("/check-deposit/{txId}")
    public ResponseEntity<CheckDepositRepresentation> checkDeposit(@AuthenticationPrincipal Long userId, @PathVariable String txId) {
        rateLimiter.check(userId, "check-deposit", DEPOSIT_COOLDOWN_MS);
        return ResponseEntity.ok(walletService.checkDeposit(userId, txId));
    }

    @PostMapping("/withdrawal/init")
    public ResponseEntity<WalletRepresentation> withdrawalInit(@AuthenticationPrincipal Long userId, @Valid @RequestBody WithdrawRequest request) {
        rateLimiter.check(userId, "withdrawal-init", WITHDRAWAL_INIT_COOLDOWN_MS);
        return ResponseEntity.ok(walletService.withdrawalInit(userId, request));
    }

    @PostMapping("/withdrawal/check")
    public ResponseEntity<WithdrawalCheckRepresentation> withdrawalCheck(@AuthenticationPrincipal Long userId) {
        rateLimiter.check(userId, "withdrawal-check", WITHDRAWAL_CHECK_COOLDOWN_MS);
        return ResponseEntity.ok(walletService.withdrawalCheck(userId));
    }
}