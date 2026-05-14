package com.example.phantom.crypto;

import com.example.phantom.crypto.deposit.Deposit;
import com.example.phantom.crypto.deposit.DepositRepresentation;
import com.example.phantom.crypto.deposit.DepositService;
import com.example.phantom.crypto.withdrawal.WithdrawRequest;
import com.example.phantom.crypto.withdrawal.Withdrawal;
import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import com.example.phantom.crypto.withdrawal.WithdrawalService;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CryptoService {

    private final UserRepository userRepository;
    private final CryptoWalletRepository cryptoWalletRepository;
    private final DepositService depositService;
    private final WithdrawalService withdrawalService;
    private final UsageLimiter usageLimiter;

    public CryptoService(
            UserRepository userRepository,
            CryptoWalletRepository cryptoWalletRepository,
            DepositService depositService,
            WithdrawalService withdrawalService,
            UsageLimiter usageLimiter
    ) {
        this.userRepository = userRepository;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.depositService = depositService;
        this.withdrawalService = withdrawalService;
        this.usageLimiter = usageLimiter;
    }

    public CryptoWalletRepresentation getWallet(Long userId, String coin) {
        CryptoWallet wallet = cryptoWalletRepository.findByUserIdAndCoin(userId, coin).orElseThrow(() -> new NotFoundException("wallet not found"));
        return new CryptoWalletRepresentation(wallet);
    }

    public List<DepositRepresentation> checkDeposits(Long userId, String coin) {
        User user = getUser(userId);
        rateLimit(user);

        List<Deposit> deposits = depositService.fetchDeposits(user, coin);
        depositService.applyDeposits(user, deposits);
        return deposits.stream().map(DepositRepresentation::new).toList();
    }

    public WithdrawalRepresentation withdraw(Long userId, String coin, WithdrawRequest request) {
        User user = getUser(userId);
        rateLimit(user);

        Withdrawal withdrawal = withdrawalService.reserveFinances(user, coin, request.getAddress(), request.getAmount());
        withdrawal = withdrawalService.send(withdrawal);
        return new WithdrawalRepresentation(withdrawal);
    }

    public List<WithdrawalRepresentation> checkPendingWithdrawals(Long userId) {
        User user = getUser(userId);
        rateLimit(user);

        List<Withdrawal> checked = withdrawalService.checkPendingStatuses(userId);
        withdrawalService.applyCheckedStatuses(userId, checked);
        return checked.stream().map(WithdrawalRepresentation::new).toList();
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }

    private void rateLimit(User user) {
        try {
            usageLimiter.startAction(user, UsageAction.CRYPTO, 1L);
        }
        catch (UsageLimitReached e) {
            throw new TooManyRequestsException(e.getMessage());
        }
    }
}
