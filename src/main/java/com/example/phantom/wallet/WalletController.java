package com.example.phantom.wallet;

import com.example.phantom.wallet.balancechange.BalanceChangeRepresentation;
import com.example.phantom.wallet.balancechange.BalanceChangeRepository;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
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
    private final BalanceChangeRepository balanceChangeRepository;

    public WalletController(WalletService walletService, BalanceChangeRepository balanceChangeRepository) {
        this.walletService = walletService;
        this.balanceChangeRepository = balanceChangeRepository;
    }

    @GetMapping("/stats")
    public ResponseEntity<PlatformWalletStatRepresentation> stats() {
        return ResponseEntity.ok(new PlatformWalletStatRepresentation(
                balanceChangeRepository.sumByType(BalanceChangeType.DEPOSIT),
                balanceChangeRepository.sumByType(BalanceChangeType.WITHDRAWAL)
                        .add(balanceChangeRepository.sumByType(BalanceChangeType.WITHDRAWAL_REFUND))
                        .abs()
        ));
    }

    @GetMapping("/me")
    public ResponseEntity<WalletRepresentation> get(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(walletService.get(userId));
    }

    @GetMapping("/me/stats")
    public ResponseEntity<PersonalWalletStatRepresentation> myStats(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(new PersonalWalletStatRepresentation(
                balanceChangeRepository.sumByType(userId, BalanceChangeType.DEPOSIT),
                balanceChangeRepository.sumByType(userId, BalanceChangeType.WITHDRAWAL)
                        .add(balanceChangeRepository.sumByType(userId, BalanceChangeType.WITHDRAWAL_REFUND))
                        .abs()
        ));
    }

    @GetMapping("/me/history")
    public ResponseEntity<List<BalanceChangeRepresentation>> getHistory(
            @AuthenticationPrincipal Long userId,
            @RequestParam @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(walletService.getHistory(userId, limit, before));
    }
}
