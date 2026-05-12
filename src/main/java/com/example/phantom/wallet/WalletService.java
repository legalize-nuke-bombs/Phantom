package com.example.phantom.wallet;

import com.example.phantom.exception.NotFoundException;
import org.springframework.stereotype.Service;

@Service
public class WalletService {

    private final WalletRepository walletRepository;

    public WalletService(WalletRepository walletRepository) {
        this.walletRepository = walletRepository;
    }

    public WalletRepresentation get(Long userId) {
        Wallet wallet = walletRepository.findById(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
        return new WalletRepresentation(wallet);
    }
}
