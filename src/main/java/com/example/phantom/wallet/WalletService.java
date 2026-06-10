package com.example.phantom.wallet;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
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

    public WalletService(WalletRepository walletRepository, UserRepository userRepository) {
        this.walletRepository = walletRepository;
        this.userRepository = userRepository;
    }

    public Wallet lock(Long userId) {
        return walletRepository.findByIdForPessimisticWrite(userId).orElseThrow(() -> new ApiException(ErrorCode.WALLET_NOT_FOUND));
    }

    public Wallet getWallet(Long userId) {
        return walletRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.WALLET_NOT_FOUND));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void addChange(Wallet wallet, BigDecimal amount) {
        wallet.setBalanceCached(wallet.getBalanceCached().add(amount));
        walletRepository.save(wallet);
    }

    public WalletRepresentation get(Long userId) {
        User user = getUser(userId);
        Wallet wallet = getWallet(user.getId());
        return new WalletRepresentation(wallet);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }
}
