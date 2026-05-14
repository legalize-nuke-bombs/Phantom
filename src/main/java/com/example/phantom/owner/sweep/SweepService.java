package com.example.phantom.owner.sweep;

import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CoinProviderRegistry;
import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoWallet;
import com.example.phantom.crypto.CryptoWalletRepository;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.variable.Variable;
import com.example.phantom.variable.VariableRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class SweepService {

    private final UserRepository userRepository;
    private final CryptoWalletRepository cryptoWalletRepository;
    private final VariableRepository variableRepository;
    private final SweepLogRepository sweepLogRepository;
    private final CoinProviderRegistry coinProviderRegistry;
    private final UsageLimiter usageLimiter;
    private volatile Instant lastSweep;

    public SweepService(
            UserRepository userRepository,
            CryptoWalletRepository cryptoWalletRepository,
            VariableRepository variableRepository,
            SweepLogRepository sweepLogRepository,
            CoinProviderRegistry coinProviderRegistry,
            UsageLimiter usageLimiter
    ) {
        this.userRepository = userRepository;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.variableRepository = variableRepository;
        this.sweepLogRepository = sweepLogRepository;
        this.coinProviderRegistry = coinProviderRegistry;
        this.usageLimiter = usageLimiter;
        this.lastSweep = Instant.now();
    }

    public List<SweepLogRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = getOwner(userId);

        try {
            usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit));
        }
        catch (UsageLimitReached e) {
            throw new TooManyRequestsException(e.getMessage());
        }

        Pageable pageable = PageRequest.of(0, limit);

        List<SweepLog> logs = before != null
                ? sweepLogRepository.findAllBeforePageable(before, pageable)
                : sweepLogRepository.findAllPageable(pageable);

        return logs.stream().map(SweepLogRepresentation::new).toList();
    }

    public Map<String, String> getSchedule(Long userId) {
        getOwner(userId);

        Variable v = variableRepository.findById("SWEEP_SCHEDULE").orElseThrow(() -> new NotFoundException("sweep schedule does not exist"));

        return Map.of("seconds", v.getValue());
    }

    public Map<String, String> setSchedule(Long userId, SetScheduleRequest request) {
        getOwner(userId);

        Variable v = new Variable();
        v.setId("SWEEP_SCHEDULE");
        v.setValue(String.valueOf(request.getSeconds()));
        variableRepository.save(v);

        return Map.of("message", "set");
    }

    public void deleteSchedule(Long userId) {
        getOwner(userId);

        try {
            variableRepository.deleteById("SWEEP_SCHEDULE");
        }
        catch (DataIntegrityViolationException e) {
            throw new NotFoundException("sweep schedule does not exist");
        }
    }

    @Scheduled(fixedDelay = 1000)
    public void sweep() {
        Variable v = variableRepository.findById("SWEEP_SCHEDULE").orElse(null);
        if (v == null) {
            return;
        }

        Instant now = Instant.now();
        if (now.getEpochSecond() - lastSweep.getEpochSecond() < Long.parseLong(v.getValue())) {
            return;
        }

        lastSweep = now;

        List<SweepLog> sweepLogs = new ArrayList<>();
        for (CoinProvider provider : coinProviderRegistry.getAll()) {
            sweepCoin(provider, sweepLogs);
        }
        sweepLogRepository.saveAll(sweepLogs);
    }

    private void sweepCoin(CoinProvider provider, List<SweepLog> sweepLogs) {
        Variable masterAddress = variableRepository.findById(provider.coin() + "_MASTER_WALLET_ADDRESS").orElse(null);
        if (masterAddress == null) {
            return;
        }
        String masterAddressValue = masterAddress.getValue();

        List<CryptoWallet> wallets = cryptoWalletRepository.findByCoin(provider.coin());

        for (CryptoWallet wallet : wallets) {
            BigDecimal amount;
            try {
                amount = provider.getBalanceUsd(wallet.getAddress());
            } catch (CryptoException e) {
                amount = null;
            }

            if (amount != null && amount.compareTo(provider.getMinSweepAmount()) >= 0) {
                String hash = null;
                try {
                    hash = provider.sendAll(wallet.getPrivateKey(), wallet.getAddress(), masterAddressValue);
                } catch (CryptoException e) {
                    log.warn("sweep failed for {}: {}", wallet.getAddress(), e.getMessage());
                }

                SweepLog sweepLog = new SweepLog();
                sweepLog.setTimestamp(Instant.now().getEpochSecond());
                sweepLog.setCoin(provider.coin());
                sweepLog.setSender(wallet.getAddress());
                sweepLog.setAmount(amount);
                sweepLog.setReceiver(masterAddressValue);
                sweepLog.setStatus(hash != null ? "ok" : "failed");
                sweepLog.setHash(hash);
                sweepLogs.add(sweepLog);
            }
        }
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (user.getRole() != Role.OWNER) {
            throw new ForbiddenException("you don't have permission to use sweep service");
        }

        return user;
    }
}
