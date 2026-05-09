package com.example.phantom.owner.masterwallet;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/owner/master-wallets")
public class MasterWalletController {

    private final MasterWalletService service;

    public MasterWalletController(MasterWalletService service) {
        this.service = service;
    }

    @GetMapping("/ton")
    public ResponseEntity<MasterWalletRepresentation> getTon(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.getTon(userId));
    }

    @PostMapping("/ton")
    public ResponseEntity<Map<String, String>> setTon(@AuthenticationPrincipal Long userId, @Valid @RequestBody SetTonMasterWalletRequest request) {
        return ResponseEntity.ok(service.setTon(userId, request));
    }
}
