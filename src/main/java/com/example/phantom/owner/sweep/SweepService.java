package com.example.phantom.owner.sweep;

import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoExchangeRateService;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.ton.TonApiException;
import com.example.phantom.ton.TonApiService;
import com.example.phantom.ton.TonWallet;
import com.example.phantom.ton.TonWalletRepository;
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
    private final TonWalletRepository tonWalletRepository;
    private final VariableRepository variableRepository;
    private final SweepLogRepository sweepLogRepository;

    private final CryptoExchangeRateService cryptoExchangeRateService;
    private final TonApiService tonApiService;

    private final UsageLimiter usageLimiter;
    private volatile Instant lastSweep;

    public SweepService(
            UserRepository userRepository,
            TonWalletRepository tonWalletRepository,
            VariableRepository variableRepository,
            SweepLogRepository sweepLogRepository,
            CryptoExchangeRateService cryptoExchangeRateService,
            TonApiService tonApiService,
            UsageLimiter usageLimiter
    ) {
        this.userRepository = userRepository;
        this.tonWalletRepository = tonWalletRepository;
        this.variableRepository = variableRepository;
        this.sweepLogRepository = sweepLogRepository;

        this.cryptoExchangeRateService = cryptoExchangeRateService;
        this.tonApiService = tonApiService;

        this.usageLimiter = usageLimiter;
        this.lastSweep = Instant.now();
    }

    public List<SweepLogRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = getOwner(userId);

        try {
            usageLimiter.startAction(user, "pagination", Long.valueOf(limit));
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
        sweepTon(sweepLogs);
        sweepLogRepository.saveAll(sweepLogs);
    }

    private void sweepTon(List<SweepLog> sweepLogs) {
        Variable masterAddress = variableRepository.findById("TON_MASTER_WALLET_ADDRESS").orElse(null);
        if (masterAddress == null) {
            return;
        }
        String masterAddressValue = masterAddress.getValue();

        BigDecimal tonUsdRate;
        try {
            tonUsdRate = cryptoExchangeRateService.getTonUsdt();
        }
        catch (CryptoException e) {
            return;
        }

        List<TonWallet> tonWallets = tonWalletRepository.findAll();

        for (TonWallet tonWallet : tonWallets) {
            String address = tonWallet.getAddress();
            String privateKey = tonWallet.getPrivateKey();

            BigDecimal amount;
            try {
                amount = tonApiService.getBalance(address).multiply(tonUsdRate);
            }
            catch (TonApiException e) {
                amount = null;
            }

            SweepLog sweepLog = new SweepLog();
            sweepLog.setTimestamp(Instant.now().getEpochSecond());
            sweepLog.setCoin("ton");
            sweepLog.setSender(address);
            sweepLog.setAmount(amount);
            sweepLog.setReceiver(masterAddressValue);

            if (amount == null || amount.compareTo(SweepConstants.MIN_SWEEP_FOR_TON) < 0) {
                sweepLog.setStatus("skipped");
            }
            else {
                String hash = null;
                try {
                    hash = tonApiService.sendAll(privateKey, address, masterAddressValue);
                }
                catch (TonApiException e) {
                    log.warn("sweep failed for {}: {}", address, e.getMessage());
                }

                sweepLog.setStatus(hash != null ? "ok" : "failed");
                sweepLog.setHash(hash);
            }

            sweepLogs.add(sweepLog);
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
