package com.example.phantom.crypto;

import com.example.phantom.crypto.deposit.Deposit;
import com.example.phantom.crypto.deposit.DepositRepresentation;
import com.example.phantom.crypto.deposit.DepositService;
import com.example.phantom.crypto.withdrawal.WithdrawRequest;
import com.example.phantom.crypto.withdrawal.Withdrawal;
import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import com.example.phantom.crypto.withdrawal.WithdrawalService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@Slf4j
public class CryptoService {

    private final UserRepository userRepository;
    private final CryptoWalletRepository cryptoWalletRepository;
    private final DepositService depositService;
    private final WithdrawalService withdrawalService;
    private final UsageLimitService usageLimitService;
    private final ProfileService profileService;

    public CryptoService(
            UserRepository userRepository,
            CryptoWalletRepository cryptoWalletRepository,
            DepositService depositService,
            WithdrawalService withdrawalService,
            UsageLimitService usageLimitService,
            ProfileService profileService
    ) {
        this.userRepository = userRepository;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.depositService = depositService;
        this.withdrawalService = withdrawalService;
        this.usageLimitService = usageLimitService;
        this.profileService = profileService;
    }

    public CryptoWalletRepresentation getWallet(Long userId, CoinType coin) {
        CryptoWallet wallet = cryptoWalletRepository.findByUserIdAndCoin(userId, coin).orElseThrow(() -> new ApiException(ErrorCode.CRYPTO_WALLET_NOT_FOUND));
        return new CryptoWalletRepresentation(wallet);
    }

    public List<DepositRepresentation> checkDeposits(Long userId, CoinType coin) {
        log.info("checking {} deposits for user {} ...", coin, userId);

        User user = getUser(userId);
        rateLimit(user);

        List<Deposit> deposits = depositService.fetchDeposits(user, coin);
        depositService.applyDeposits(user, deposits);

        log.info("applied {} {} deposits for user {}", deposits.size(), coin, userId);
        return deposits.stream().map(DepositRepresentation::new).toList();
    }

    public WithdrawalRepresentation withdraw(Long userId, CoinType coin, WithdrawRequest request) {
        String address = request.getAddress();
        BigDecimal amount = request.getAmount();

        log.info("withdrawing {} to {} {} for {} ...", amount, coin, address, userId);

        User user = getUser(userId);
        rateLimit(user);

        Withdrawal withdrawal = withdrawalService.reserveFinances(user, coin, address, amount);
        withdrawal = withdrawalService.send(withdrawal);

        log.info("withdrawal request created {}, {}, {}, {}", amount, coin, address, user.getId());
        return new WithdrawalRepresentation(withdrawal, profileService.getCardForUser(user.getId(), user));
    }

    public List<WithdrawalRepresentation> checkPendingWithdrawals(Long userId) {
        log.info("checking pending withdrawals for {} ...", userId);

        User user = getUser(userId);
        rateLimit(user);

        List<Withdrawal> checked = withdrawalService.checkPendingStatuses(userId);
        withdrawalService.applyCheckedStatuses(userId, checked);

        log.info("found {} pending withdrawals for {}", checked.size(), user.getId());
        ProfileCardRepresentation profileCard = profileService.getCardForUser(user.getId(), user);
        return checked.stream().map(withdrawal -> new WithdrawalRepresentation(withdrawal, profileCard)).toList();
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private void rateLimit(User user) {
        usageLimitService.startAction(user, UsageAction.CRYPTO, 1L);
    }
}
