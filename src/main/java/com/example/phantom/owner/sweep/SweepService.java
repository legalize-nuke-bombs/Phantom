package com.example.phantom.owner.sweep;

import com.example.phantom.crypto.*;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.owner.masterwallet.MasterWalletSetting;
import com.example.phantom.owner.masterwallet.MasterWalletSettingRepository;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final SweepSettingRepository sweepSettingRepository;
    private final MasterWalletSettingRepository masterWalletSettingRepository;
    private final SweepLogRepository sweepLogRepository;
    private final CoinProviderRegistry coinProviderRegistry;
    private final UsageLimitService usageLimitService;
    private volatile Instant lastSweep;

    public SweepService(
            UserRepository userRepository,
            CryptoWalletRepository cryptoWalletRepository,
            SweepSettingRepository sweepSettingRepository,
            MasterWalletSettingRepository masterWalletSettingRepository,
            SweepLogRepository sweepLogRepository,
            CoinProviderRegistry coinProviderRegistry,
            UsageLimitService usageLimitService
    ) {
        this.userRepository = userRepository;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.sweepSettingRepository = sweepSettingRepository;
        this.masterWalletSettingRepository = masterWalletSettingRepository;
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

        SweepSetting setting = sweepSettingRepository.find().orElseThrow(() -> new ApiException(ErrorCode.SWEEP_SCHEDULE_NOT_FOUND));
        Long delay = setting.getDelay();
        if (delay == null) {
            throw new ApiException(ErrorCode.SWEEP_SCHEDULE_NOT_FOUND);
        }

        return Map.of("seconds", String.valueOf(setting.getDelay()));
    }

    public Map<String, String> setSchedule(Long userId, SetScheduleRequest request) {
        getOwner(userId);

        SweepSetting setting = sweepSettingRepository.find().orElseGet(SweepSetting::new);
        setting.setDelay(request.getSeconds());
        sweepSettingRepository.save(setting);

        return Map.of("message", "set");
    }

    public void deleteSchedule(Long userId) {
        getOwner(userId);

        SweepSetting setting = sweepSettingRepository.find().orElseThrow(() -> new ApiException(ErrorCode.SWEEP_SCHEDULE_NOT_FOUND));
        setting.setDelay(null);
        sweepSettingRepository.save(setting);
    }

    @Scheduled(fixedDelay = 10 * 1000)
    public void sweep() {
        SweepSetting setting = sweepSettingRepository.find().orElse(null);
        if (setting == null) {
            return;
        }
        Long delay = setting.getDelay();
        if (delay == null) {
            return;
        }

        Instant now = Instant.now();
        if (now.getEpochSecond() - lastSweep.getEpochSecond() < delay) {
            return;
        }

        log.info("starting sweep...");

        lastSweep = now;

        for (CoinProvider provider : coinProviderRegistry.getAll()) {
            sweepCoin(provider);
        }

        log.info("sweep finished");
    }

    private void sweepCoin(CoinProvider provider) {
        CoinType coin = provider.coin();
        log.info("starting {} sweep...", coin);

        MasterWalletSetting masterWalletSetting = masterWalletSettingRepository.findByCoinType(provider.coin()).orElse(null);
        if (masterWalletSetting == null) {
            log.info("{} sweep skipped: no master wallet specified", coin);
            return;
        }
        String masterAddressValue = masterWalletSetting.getAddress();
        if (masterAddressValue == null) {
            log.info("{} sweep skipped: no master wallet specified", coin);
            return;
        }

        List<CryptoWallet> wallets = cryptoWalletRepository.findByCoin(provider.coin());

        for (CryptoWallet wallet : wallets) {
            try { Thread.sleep(SweepConstants.INTERNAL_SWEEP_DELAY_MS); }
            catch (InterruptedException e) { continue; }

            String address = wallet.getAddress();
            log.info("sweeping {} from {} ...", coin, address);

            log.info("fetching {} {} balance...", coin, address);
            BigDecimal amount;
            try {
                amount = provider.getBalanceUsd(address);
                log.info("{} {} balance = {}", coin, address, amount);
            }
            catch (CryptoException e) {
                amount = null;
                log.warn("failed to fetch {} {} balance: {}", coin, address, e.getMessage());
            }

            if (amount == null) {
                continue;
            }

            if (amount.compareTo(provider.getMinSweepAmount()) >= 0) {
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
                sweepLogRepository.save(sweepLog);
            }
            else {
                log.info("send all {} from {} skipped", coin, address);

                User user = wallet.getUser();
                if (user == null) {
                    log.info("{} {} wallet is empty and was abandoned, deleting...", coin, address);
                    cryptoWalletRepository.delete(wallet);
                }
            }
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
