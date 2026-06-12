package com.example.phantom.owner.masterwallet;

import com.example.phantom.crypto.CoinType;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
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

    @GetMapping("/{coin}")
    public ResponseEntity<MasterWalletRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin) {
        return ResponseEntity.ok(service.get(userId, getCoin(coin)));
    }

    @PostMapping("/{coin}")
    public ResponseEntity<Map<String, String>> set(
            @AuthenticationPrincipal Long userId,
            @PathVariable String coin,
            @Valid @RequestBody SetMasterWalletRequest request) {
        return ResponseEntity.ok(service.set(userId, getCoin(coin), request));
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
