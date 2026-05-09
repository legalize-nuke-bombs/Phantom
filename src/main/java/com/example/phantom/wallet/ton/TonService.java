package com.example.phantom.wallet.ton;

import com.example.phantom.exception.NotFoundException;
import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class TonService {

    private final TonWalletRepository tonWalletRepository;

    public TonService(TonWalletRepository tonWalletRepository) {
        this.tonWalletRepository = tonWalletRepository;
    }

    public Map<String, String> get(Long userId) {
        TonWallet tw = tonWalletRepository.findByUserId(userId).orElseThrow(() -> new NotFoundException("ton wallet not found"));
        return Map.of("depositAddress", tw.getAddress());
    }

    public Void checkDeposits() {
        return null;
    }

    public Void withdraw() {
        return null;
    }

    public Void checkWithdrawals() { return null; }
}
