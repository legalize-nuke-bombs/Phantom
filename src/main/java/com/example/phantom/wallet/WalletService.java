package com.example.phantom.wallet;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.balancechange.BalanceChange;
import com.example.phantom.wallet.balancechange.BalanceChangeRepository;
import com.example.phantom.wallet.balancechange.BalanceChangeRepresentation;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
public class WalletService {

    private final WalletRepository walletRepository;
    private final BalanceChangeRepository balanceChangeRepository;
    private final UserRepository userRepository;
    private final UsageLimiter usageLimiter;

    public WalletService(WalletRepository walletRepository, BalanceChangeRepository balanceChangeRepository, UserRepository userRepository, UsageLimiter usageLimiter) {
        this.walletRepository = walletRepository;
        this.balanceChangeRepository = balanceChangeRepository;
        this.userRepository = userRepository;
        this.usageLimiter = usageLimiter;
    }

    public void lock(Long userId) {
        walletRepository.findByIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
    }

    public BigDecimal getBalance(Long userId) {
        return balanceChangeRepository.getBalance(userId);
    }

    public BigDecimal getDepositsSum(Long userId) {
        return balanceChangeRepository.sumByType(userId, BalanceChangeType.DEPOSIT);
    }

    public void addChange(User user, BigDecimal amount, BalanceChangeType type) {
        BalanceChange change = new BalanceChange();
        change.setUser(user);
        change.setAmount(amount);
        change.setType(type);
        change.setTimestamp(Instant.now().getEpochSecond());
        balanceChangeRepository.save(change);
    }

    public WalletRepresentation get(Long userId) {
        BigDecimal balance = getBalance(userId);
        return new WalletRepresentation(userId, balance);
    }

    public PlatformWalletStatRepresentation getStats() {
        return new PlatformWalletStatRepresentation(
                balanceChangeRepository.sumByType(BalanceChangeType.DEPOSIT),
                balanceChangeRepository.sumByType(BalanceChangeType.WITHDRAWAL)
                        .add(balanceChangeRepository.sumByType(BalanceChangeType.WITHDRAWAL_REFUND))
                        .abs()
        );
    }

    public PersonalWalletStatRepresentation getMyStats(Long userId) {
        return new PersonalWalletStatRepresentation(
                balanceChangeRepository.sumByType(userId, BalanceChangeType.DEPOSIT),
                balanceChangeRepository.sumByType(userId, BalanceChangeType.WITHDRAWAL)
                        .add(balanceChangeRepository.sumByType(userId, BalanceChangeType.WITHDRAWAL_REFUND))
                        .abs()
        );
    }

    public List<BalanceChangeRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<BalanceChange> changes = before != null
                ? balanceChangeRepository.findByUserIdBeforePageable(userId, before, pageable)
                : balanceChangeRepository.findByUserIdPageable(userId, pageable);

        return changes.stream().map(BalanceChangeRepresentation::new).toList();
    }
}
