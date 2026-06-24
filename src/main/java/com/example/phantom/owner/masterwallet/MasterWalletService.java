package com.example.phantom.owner.masterwallet;

import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CoinProviderRegistry;
import com.example.phantom.crypto.CoinType;
import com.example.phantom.crypto.CryptoException;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.topic.globaltopic.GlobalTopicService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;

@Service
@Slf4j
public class MasterWalletService {

    private final UserRepository userRepository;
    private final MasterWalletSettingRepository masterWalletSettingRepository;
    private final CoinProviderRegistry coinProviderRegistry;
    private final NotificationPublishService notificationPublishService;
    private final GlobalTopicService globalTopicService;

    public MasterWalletService(
            UserRepository userRepository,
            MasterWalletSettingRepository masterWalletSettingRepository,
            CoinProviderRegistry coinProviderRegistry,
            NotificationPublishService notificationPublishService,
            GlobalTopicService globalTopicService
    ) {
        this.userRepository = userRepository;
        this.masterWalletSettingRepository = masterWalletSettingRepository;
        this.coinProviderRegistry = coinProviderRegistry;
        this.notificationPublishService = notificationPublishService;
        this.globalTopicService = globalTopicService;
    }

    public MasterWalletRepresentation get(Long userId, CoinType coin) {
        getOwner(userId);

        CoinProvider provider = coinProviderRegistry.get(coin);

        MasterWalletSetting setting = masterWalletSettingRepository.findByCoinType(coin).orElseThrow(() -> new ApiException(ErrorCode.MASTER_WALLET_NOT_SET));
        String address = setting.getAddress();
        if (address == null) {
            throw new ApiException(ErrorCode.MASTER_WALLET_NOT_SET);
        }

        BigDecimal balance;
        try {
            balance = provider.getBalanceUsd(address);
        }
        catch (CryptoException e) {
            throw new ApiException(ErrorCode.UPSTREAM_ERROR);
        }

        MasterWalletRepresentation representation = new MasterWalletRepresentation();
        representation.setAddress(address);
        representation.setBalance(balance);
        return representation;
    }

    @Transactional
    public Map<String, String> set(Long userId, CoinType coin, SetMasterWalletRequest request) {
        User user = getOwner(userId);

        CoinProvider provider = coinProviderRegistry.get(coin);

        CoinProvider.KeyPair keyPair;
        try {
            keyPair = provider.deriveKeyPair(request.getMnemonic());
        }
        catch (CryptoException e) {
            throw new ApiException(ErrorCode.BAD_MNEMONIC);
        }

        MasterWalletSetting setting = masterWalletSettingRepository.findByCoinType(coin).orElseGet(() -> {
            MasterWalletSetting defaultSetting = new MasterWalletSetting();
            defaultSetting.setCoin(coin);
            return defaultSetting;
        });

        setting.setAddress(keyPair.address());
        setting.setPrivateKey(keyPair.privateKey());
        masterWalletSettingRepository.save(setting);

        notificationPublishService.createTopicNotification(globalTopicService.findOwners(), NotificationType.MASTER_WALLET_SET, new UserShortRepresentation(user));
        log.info("set {} master wallet by user {}", coin, userId);
        return Map.of("message", "set");
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        if (!user.getRole().getOwnerAccess()) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return user;
    }
}
