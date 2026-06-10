package com.example.phantom.wallet;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class WalletService {

    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final UsageLimiter usageLimiter;
    private final PrivacySettingValidator privacySettingValidator;

    public WalletService(WalletRepository walletRepository, UserRepository userRepository, UsageLimiter usageLimiter, PrivacySettingValidator privacySettingValidator) {
        this.walletRepository = walletRepository;
        this.userRepository = userRepository;
        this.usageLimiter = usageLimiter;
        this.privacySettingValidator = privacySettingValidator;
    }

    public Wallet lock(Long userId) {
        return walletRepository.findByIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
    }

    public Wallet getWallet(Long userId) {
        return walletRepository.findById(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void addChange(Wallet wallet, BigDecimal amount) {
        // history is not being recorded for security reasons

        wallet.setBalanceCached(wallet.getBalanceCached().add(amount));
        walletRepository.save(wallet);
    }

    public WalletRepresentation get(Long userId) {
        User user = getUser(userId);
        Wallet wallet = getWallet(user.getId());
        return new WalletRepresentation(wallet);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }
}
