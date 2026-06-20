package com.example.phantom.crypto;

import com.example.phantom.crypto.deposit.DepositRepresentation;
import com.example.phantom.crypto.withdrawal.WithdrawRequest;
import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Validated
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
        return ResponseEntity.ok(service.getWallet(userId, getCoin(coin)));
    }

    @PostMapping("/{coin}/check-deposits")
    public ResponseEntity<List<DepositRepresentation>> checkDeposits(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin) {
        return ResponseEntity.ok(service.checkDeposits(userId, getCoin(coin)));
    }

    @GetMapping("/{coin}/deposits")
    public ResponseEntity<List<DepositRepresentation>> getDeposits(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit
    ) {
        return ResponseEntity.ok(service.getDeposits(userId, getCoin(coin), before, limit));
    }

    @PostMapping("/{coin}/withdraw")
    public ResponseEntity<WithdrawalRepresentation> withdraw(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin,
            @Valid @RequestBody WithdrawRequest request) {
        return ResponseEntity.ok(service.withdraw(userId, getCoin(coin), request));
    }

    @PostMapping("/{coin}/check-pending-withdrawals")
    public ResponseEntity<List<WithdrawalRepresentation>> checkPendingWithdrawals(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin) {
        return ResponseEntity.ok(service.checkPendingWithdrawals(userId, getCoin(coin)));
    }

    @GetMapping("/{coin}/withdrawals")
    public ResponseEntity<List<WithdrawalRepresentation>> getWithdrawals(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit
            ) {
        return ResponseEntity.ok(service.getWithdrawals(userId, getCoin(coin), before, limit));
    }

    private CoinType getCoin(String coin) {
        CoinType coinType;
        try {
            coinType = CoinType.valueOf(coin.toUpperCase());
        }
        catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.UNSUPPORTED_COIN);
        }
        return coinType;
    }
}
