package com.example.phantom.wallet;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.PrivacySettingValidator;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.balancechange.BalanceChange;
import com.example.phantom.wallet.balancechange.BalanceChangeRepository;
import com.example.phantom.wallet.balancechange.BalanceChangeRepresentation;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
public class WalletService {

    private final WalletRepository walletRepository;
    private final BalanceChangeRepository balanceChangeRepository;
    private final UserRepository userRepository;
    private final UsageLimiter usageLimiter;
    private final PrivacySettingValidator privacySettingValidator;

    public WalletService(WalletRepository walletRepository, BalanceChangeRepository balanceChangeRepository, UserRepository userRepository, UsageLimiter usageLimiter, PrivacySettingValidator privacySettingValidator) {
        this.walletRepository = walletRepository;
        this.balanceChangeRepository = balanceChangeRepository;
        this.userRepository = userRepository;
        this.usageLimiter = usageLimiter;
        this.privacySettingValidator = privacySettingValidator;
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

    public BalanceChange addChange(User user, BigDecimal amount, BalanceChangeType type, String details) {
        BalanceChange change = new BalanceChange();
        change.setUser(user);
        change.setAmount(amount);
        change.setType(type);
        change.setTimestamp(Instant.now().getEpochSecond());
        change.setDetails(details);
        return balanceChangeRepository.save(change);
    }

    public WalletRepresentation get(Long userId, Long targetId) {
        User user = getUser(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getWalletBalancePrivacySetting());

        BigDecimal balance = getBalance(target.getId());
        return new WalletRepresentation(target.getId(), balance);
    }

    @Transactional
    public BalanceChangeRepresentation send(Long userId, Long targetId, SendRequest request) {
        User user = getUser(userId);
        User target = getUser(targetId);

        if (Objects.equals(user.getId(), target.getId())) {
            throw new BadRequestException("can't self send");
        }

        BigDecimal amount = request.getAmount();

        lock(Math.min(user.getId(), target.getId())); // locks being done by specified order to prevent deadlock problem
        lock(Math.max(user.getId(), target.getId()));

        if (getBalance(userId).compareTo(amount) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        lock(target.getId());

        BalanceChange bc = addChange(user, amount.negate(), BalanceChangeType.INTERUSER_SEND, "to " + target.getId());
        addChange(target, amount, BalanceChangeType.INTERUSER_RECEIVE, "from " + user.getId());

        return new BalanceChangeRepresentation(bc);
    }

    public PlatformWalletStatRepresentation getStats() {
        return new PlatformWalletStatRepresentation(
                balanceChangeRepository.sumByType(BalanceChangeType.DEPOSIT),
                balanceChangeRepository.sumByType(BalanceChangeType.WITHDRAWAL)
                        .add(balanceChangeRepository.sumByType(BalanceChangeType.WITHDRAWAL_REFUND))
                        .abs()
        );
    }

    public PersonalWalletStatRepresentation getStats(Long userId, Long targetId) {
        User user = getUser(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getWalletStatsPrivacySetting());

        return new PersonalWalletStatRepresentation(
                balanceChangeRepository.sumByType(target.getId(), BalanceChangeType.DEPOSIT),
                balanceChangeRepository.sumByType(target.getId(), BalanceChangeType.WITHDRAWAL)
                        .add(balanceChangeRepository.sumByType(target.getId(), BalanceChangeType.WITHDRAWAL_REFUND))
                        .abs()
        );
    }

    public List<BalanceChangeRepresentation> getHistory(Long userId, Long targetId, Integer limit, Long before) {
        User user = getUser(userId);
        User target = getUser(targetId);

        privacySettingValidator.validate(user.getId(), target.getId(), target.getWalletHistoryPrivacySetting());

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<BalanceChange> changes = before != null
                ? balanceChangeRepository.findByUserIdBeforePageable(target.getId(), before, pageable)
                : balanceChangeRepository.findByUserIdPageable(target.getId(), pageable);

        return changes.stream().map(BalanceChangeRepresentation::new).toList();
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }
}
