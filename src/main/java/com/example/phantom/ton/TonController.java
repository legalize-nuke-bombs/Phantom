package com.example.phantom.ton;

import com.example.phantom.ton.deposit.TonDepositRepresentation;
import com.example.phantom.ton.withdrawal.TonWithdrawRequest;
import com.example.phantom.ton.withdrawal.TonWithdrawalRepresentation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wallet/ton")
public class TonController {

    private final TonService service;

    public TonController(TonService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<Map<String, String>> get(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.get(userId));
    }

    @PostMapping("/check-deposits")
    public ResponseEntity<List<TonDepositRepresentation>> checkDeposits(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.checkDeposits(userId));
    }

    @PostMapping("/withdraw")
    public ResponseEntity<TonWithdrawalRepresentation> withdraw(@AuthenticationPrincipal Long userId, @Valid @RequestBody TonWithdrawRequest request) {
        return ResponseEntity.ok(service.withdraw(userId, request));
    }

    @PostMapping("/check-pending-withdrawals")
    public ResponseEntity<List<TonWithdrawalRepresentation>> checkPendingWithdrawals(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.checkPendingWithdrawals(userId));
    }
}
