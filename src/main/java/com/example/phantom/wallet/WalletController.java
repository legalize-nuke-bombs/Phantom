package com.example.phantom.wallet;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/wallets")
public class WalletController {

    private final WalletService walletService;

    public WalletController(WalletService walletService) {
        this.walletService = walletService;
    }

    @GetMapping("/me")
    public ResponseEntity<WalletRepresentation> get(
            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(walletService.get(userId));
    }

    @PostMapping("/me/send/{targetId}")
    public ResponseEntity<Void> send(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long targetId,
            @Valid @RequestBody SendRequest request
    ) {
        walletService.send(userId, targetId, request);
        return ResponseEntity.status(HttpStatus.OK).build();
    }
}
