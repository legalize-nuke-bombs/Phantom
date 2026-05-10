package com.example.phantom.wallet.ton;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.ratelimit.RateLimitReached;
import com.example.phantom.ratelimit.RateLimiter;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class TonService {

    private final UserRepository userRepository;
    private final TonWalletRepository tonWalletRepository;

    private final TonDepositService tonDepositService;

    private final RateLimiter rateLimiter;

    public TonService(UserRepository userRepository, TonWalletRepository tonWalletRepository, TonDepositService tonDepositService, RateLimiter rateLimiter) {
        this.userRepository = userRepository;
        this.tonWalletRepository = tonWalletRepository;

        this.tonDepositService = tonDepositService;

        this.rateLimiter = rateLimiter;
    }

    public Map<String, String> get(Long userId) {
        TonWallet tonWallet = tonWalletRepository.findByUserId(userId).orElseThrow(() -> new NotFoundException("ton wallet not found"));
        return Map.of("depositAddress", tonWallet.getAddress());
    }

    public List<TonDepositRepresentation> checkDeposits(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        try { rateLimiter.startAction(user, "crypto", 1L); }
        catch (RateLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        List<TonDeposit> tonDeposits = tonDepositService.fetchDeposits(user);
        tonDepositService.applyDeposits(user, tonDeposits);
        return tonDeposits.stream().map(TonDepositRepresentation::new).toList();
    }
}