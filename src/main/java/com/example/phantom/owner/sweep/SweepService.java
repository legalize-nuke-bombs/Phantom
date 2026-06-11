package com.example.phantom.owner.sweep;

import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CoinProviderRegistry;
import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoWallet;
import com.example.phantom.crypto.CryptoWalletRepository;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
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
    private final UsageLimitService usageLimitService;
    private volatile Instant lastSweep;

    public SweepService(
            UserRepository userRepository,
            CryptoWalletRepository cryptoWalletRepository,
            VariableRepository variableRepository,
            SweepLogRepository sweepLogRepository,
            CoinProviderRegistry coinProviderRegistry,
            UsageLimitService usageLimitService
    ) {
        this.userRepository = userRepository;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.variableRepository = variableRepository;
        this.sweepLogRepository = sweepLogRepository;
        this.coinProviderRegistry = coinProviderRegistry;
        this.usageLimitService = usageLimitService;
        this.lastSweep = Instant.now();
    }

    public List<SweepLogRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = getOwner(userId);

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<SweepLog> logs = sweepLogRepository.findAllPageable(before, pageable);

        return logs.stream().map(SweepLogRepresentation::new).toList();
    }

    public Map<String, String> getSchedule(Long userId) {
        getOwner(userId);

        Variable v = variableRepository.findById("SWEEP_SCHEDULE").orElseThrow(() -> new ApiException(ErrorCode.SWEEP_SCHEDULE_NOT_FOUND));

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
            throw new ApiException(ErrorCode.SWEEP_SCHEDULE_NOT_FOUND);
        }
    }

    @Scheduled(fixedDelay = 10 * 1000)
    public void sweep() {
        Variable v = variableRepository.findById("SWEEP_SCHEDULE").orElse(null);
        if (v == null) {
            return;
        }

        Instant now = Instant.now();
        if (now.getEpochSecond() - lastSweep.getEpochSecond() < Long.parseLong(v.getValue())) {
            return;
        }

        log.info("starting sweep...");

        lastSweep = now;

        List<SweepLog> sweepLogs = new ArrayList<>();
        for (CoinProvider provider : coinProviderRegistry.getAll()) {
            sweepCoin(provider, sweepLogs);
        }
        sweepLogRepository.saveAll(sweepLogs);

        log.info("sweep finished");
    }

    private void sweepCoin(CoinProvider provider, List<SweepLog> sweepLogs) {
        String coin = provider.coin();
        log.info("starting {} sweep...", coin);

        Variable masterAddress = variableRepository.findById(coin + "_MASTER_WALLET_ADDRESS").orElse(null);
        if (masterAddress == null) {
            log.info("{} sweep skipped: no master wallet specified", coin);
            return;
        }
        String masterAddressValue = masterAddress.getValue();

        List<CryptoWallet> wallets = cryptoWalletRepository.findByCoin(provider.coin());

        for (CryptoWallet wallet : wallets) {
            String address = wallet.getAddress();
            log.info("sweeping {} from {} ...", coin, address);

            log.info("fetching {} {} balance...", coin, address);
            BigDecimal amount;
            try {
                amount = provider.getBalanceUsd(address);
                log.info("{} {} balance = {}", coin, wallet, amount);
            }
            catch (CryptoException e) {
                amount = null;
                log.warn("failed to fetch {} {} balance: {}", coin, wallet, e.getMessage());
            }

            if (amount != null && amount.compareTo(provider.getMinSweepAmount()) >= 0) {
                String hash = null;
                log.info("sending all {} from {} ...", coin, address);
                try {
                    hash = provider.sendAll(wallet.getPrivateKey(), address, masterAddressValue);
                    log.info("sent all {} from {} hash = {}", coin, address, hash);
                }
                catch (CryptoException e) {
                    log.warn("failed to send all {} from {}: {}", coin, address, e.getMessage());
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
            else {
                log.info("send all {} from {} skipped", coin, address);
            }

            try { Thread.sleep(SweepConstants.INTERNAL_SWEEP_DELAY_MS); }
            catch (InterruptedException e) { continue; }
        }

        log.info("{} sweep finished", coin);
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        if (user.getRole() != Role.OWNER) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }

        return user;
    }
}
