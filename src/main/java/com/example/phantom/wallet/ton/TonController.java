package com.example.phantom.wallet.ton;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
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
    public ResponseEntity<Void> checkDeposits() {
        return ResponseEntity.ok(service.checkDeposits());
    }

    @PostMapping("/withdraw")
    public ResponseEntity<Void> withdraw() {
        return ResponseEntity.ok(service.withdraw());
    }

    @PostMapping("/check-withdrawals")
    public ResponseEntity<Void> checkWithdrawals() { return ResponseEntity.ok(service.checkWithdrawals()); }
}
