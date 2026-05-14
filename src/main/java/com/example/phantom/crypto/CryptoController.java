package com.example.phantom.crypto;

import com.example.phantom.crypto.deposit.DepositRepresentation;
import com.example.phantom.crypto.withdrawal.WithdrawRequest;
import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wallets/me/crypto")
public class CryptoController {

    private final CryptoService service;

    public CryptoController(CryptoService service) {
        this.service = service;
    }

    @GetMapping("/{coin}")
    public ResponseEntity<CryptoWalletRepresentation> getWallet(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin) {
        return ResponseEntity.ok(service.getWallet(userId, coin));
    }

    @PostMapping("/{coin}/check-deposits")
    public ResponseEntity<List<DepositRepresentation>> checkDeposits(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin) {
        return ResponseEntity.ok(service.checkDeposits(userId, coin));
    }

    @PostMapping("/{coin}/withdraw")
    public ResponseEntity<WithdrawalRepresentation> withdraw(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin,
            @Valid @RequestBody WithdrawRequest request) {
        return ResponseEntity.ok(service.withdraw(userId, coin, request));
    }

    @PostMapping("/check-pending-withdrawals")
    public ResponseEntity<List<WithdrawalRepresentation>> checkPendingWithdrawals(
            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.checkPendingWithdrawals(userId));
    }
}
