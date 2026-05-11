package com.example.phantom.ton;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.ratelimit.RateLimitReached;
import com.example.phantom.ratelimit.RateLimiter;
import com.example.phantom.ton.deposit.TonDeposit;
import com.example.phantom.ton.deposit.TonDepositRepresentation;
import com.example.phantom.ton.deposit.TonDepositService;
import com.example.phantom.ton.withdrawal.TonWithdrawRequest;
import com.example.phantom.ton.withdrawal.TonWithdrawal;
import com.example.phantom.ton.withdrawal.TonWithdrawalRepresentation;
import com.example.phantom.ton.withdrawal.TonWithdrawalService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TonService {

    private final UserRepository userRepository;
    private final TonWalletRepository tonWalletRepository;
    private final TonDepositService tonDepositService;
    private final TonWithdrawalService tonWithdrawalService;
    private final RateLimiter rateLimiter;

    public TonService(
            UserRepository userRepository,
            TonWalletRepository tonWalletRepository,
            TonDepositService tonDepositService,
            TonWithdrawalService tonWithdrawalService,
            RateLimiter rateLimiter
    ) {
        this.userRepository = userRepository;
        this.tonWalletRepository = tonWalletRepository;
        this.tonDepositService = tonDepositService;
        this.tonWithdrawalService = tonWithdrawalService;
        this.rateLimiter = rateLimiter;
    }

    public Map<String, String> get(Long userId) {
        TonWallet tonWallet = tonWalletRepository.findByUserId(userId).orElseThrow(() -> new NotFoundException("ton wallet not found"));

        return Map.of("depositAddress", tonWallet.getAddress());
    }

    public List<TonDepositRepresentation> checkDeposits(Long userId) {
        User user = getUser(userId);
        rateLimit(user);

        List<TonDeposit> deposits = tonDepositService.fetchDeposits(user);
        tonDepositService.applyDeposits(user, deposits);
        return deposits.stream().map(TonDepositRepresentation::new).toList();
    }

    public TonWithdrawalRepresentation withdraw(Long userId, TonWithdrawRequest request) {
        User user = getUser(userId);
        rateLimit(user);

        TonWithdrawal withdrawal = tonWithdrawalService.reserveFinances(user, request.getAddress(), request.getAmount());
        withdrawal = tonWithdrawalService.send(withdrawal);
        return new TonWithdrawalRepresentation(withdrawal);
    }

    public List<TonWithdrawalRepresentation> checkPendingWithdrawals(Long userId) {
        User user = getUser(userId);
        rateLimit(user);

        List<TonWithdrawal> checked = tonWithdrawalService.checkPendingStatuses(userId);
        tonWithdrawalService.applyCheckedStatuses(userId, checked);
        return checked.stream().map(TonWithdrawalRepresentation::new).toList();
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }

    private void rateLimit(User user) {
        try {
            rateLimiter.startAction(user, "crypto", 1L);
        }
        catch (RateLimitReached e) {
            throw new TooManyRequestsException(e.getMessage());
        }
    }
}
