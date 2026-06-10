package com.example.phantom.auth;

import com.example.phantom.jwt.JwtTokenProvider;
import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CoinProviderRegistry;
import com.example.phantom.crypto.CryptoWallet;
import com.example.phantom.crypto.CryptoWalletRepository;
import com.example.phantom.experience.Experience;
import com.example.phantom.experience.ExperienceRepository;
import com.example.phantom.owner.OwnerAccessValidator;
import com.example.phantom.ref.RefMember;
import com.example.phantom.ref.RefMemberRepository;
import com.example.phantom.ref.RefStorage;
import com.example.phantom.ref.RefStorageRepository;
import com.example.phantom.user.*;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final ExperienceRepository experienceRepository;
    private final CryptoWalletRepository cryptoWalletRepository;
    private final RefStorageRepository refStorageRepository;
    private final RefMemberRepository refMemberRepository;

    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final PasswordValidationService passwordValidationService;
    private final OwnerAccessValidator ownerAccessValidator;
    private final RecoveryKeyProvider recoveryKeyProvider;
    private final CoinProviderRegistry coinProviderRegistry;

    public AuthService(UserRepository userRepository, WalletRepository walletRepository, ExperienceRepository experienceRepository, CryptoWalletRepository cryptoWalletRepository, RefStorageRepository refStorageRepository, RefMemberRepository refMemberRepository, JwtTokenProvider jwtTokenProvider, PasswordEncoder passwordEncoder, PasswordValidationService passwordValidationService, OwnerAccessValidator ownerAccessValidator, RecoveryKeyProvider recoveryKeyProvider, CoinProviderRegistry coinProviderRegistry) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.experienceRepository = experienceRepository;
        this.cryptoWalletRepository = cryptoWalletRepository;
        this.refStorageRepository = refStorageRepository;
        this.refMemberRepository = refMemberRepository;

        this.jwtTokenProvider = jwtTokenProvider;
        this.passwordEncoder = passwordEncoder;
        this.passwordValidationService = passwordValidationService;
        this.ownerAccessValidator = ownerAccessValidator;
        this.recoveryKeyProvider = recoveryKeyProvider;
        this.coinProviderRegistry = coinProviderRegistry;
    }

    @Transactional
    public Map<String, String> register(RegisterRequest request, Long refId) {
        String username = request.getUsername();
        String displayName = request.getDisplayName();
        String password = request.getPassword();
        String adminKey = request.getOwnerKey();
        Role role = request.getRole();

        passwordValidationService.validate(password);

        boolean isOwner = ownerAccessValidator.isOwner(adminKey);

        if (!isOwner && role != null) {
            throw new ApiException(ErrorCode.OWNER_KEY_REQUIRED);
        }
        if (isOwner && role == null) {
            throw new ApiException(ErrorCode.ROLE_REQUIRED);
        }

        if (role == null) {
            role = Role.USER;
        }

        RecoveryKeyProvider.KeyPair recoveryKeyPair = recoveryKeyProvider.generateKeyPair();
        String recoveryKey = recoveryKeyProvider.keyPairToRecoveryKey(recoveryKeyPair);

        User user = new User();
        user.setUsername(username);
        user.setDisplayName(displayName);
        user.setRegisteredAt(Instant.now().getEpochSecond());
        user.setRole(role);
        user.setGameHistoryPrivacySetting(PrivacySetting.EVERYONE);
        user.setGameStatsPrivacySetting(PrivacySetting.EVERYONE);
        user.setExperiencePrivacySetting(PrivacySetting.EVERYONE);
        user.setLotteryPrivacySetting(PrivacySetting.EVERYONE);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setPublicRecoveryKey(recoveryKeyPair.publicKey());
        user.setPrivateRecoveryKeyHash(passwordEncoder.encode(recoveryKeyPair.privateKey()));
        try { user = userRepository.save(user); }
        catch (DataIntegrityViolationException e) { throw new ApiException(ErrorCode.USERNAME_TAKEN); }

        Wallet wallet = new Wallet();
        wallet.setUser(user);
        wallet.setBalanceCached(BigDecimal.ZERO);
        walletRepository.save(wallet);

        Experience experience = new Experience();
        experience.setUser(user);
        experience.setAmountCached(0L);
        experienceRepository.save(experience);

        RefStorage refStorage = new RefStorage();
        refStorage.setUser(user);
        refStorage.setAmount(BigDecimal.ZERO);
        refStorage.setTotal(BigDecimal.ZERO);
        refStorageRepository.save(refStorage);

        if (refId != null && !Objects.equals(user.getId(), refId)) {
            RefStorage refRefStorage = refStorageRepository.findById(refId).orElse(null);
            if (refRefStorage != null) {
                RefMember refMember = new RefMember();
                refMember.setUser(user);
                refMember.setRefStorage(refRefStorage);
                refMemberRepository.save(refMember);
            }
        }

        for (CoinProvider provider : coinProviderRegistry.getAll()) {
            try {
                String mnemonic = provider.generateMnemonic();
                CoinProvider.KeyPair keyPair = provider.deriveKeyPair(mnemonic);

                CryptoWallet cryptoWallet = new CryptoWallet();
                cryptoWallet.setUser(user);
                cryptoWallet.setCoin(provider.coin());
                cryptoWallet.setMnemonic(mnemonic);
                cryptoWallet.setAddress(keyPair.address());
                cryptoWallet.setPrivateKey(keyPair.privateKey());
                cryptoWalletRepository.save(cryptoWallet);
            }
            catch (Exception e) {
                throw new RuntimeException("failed to create " + provider.coin() + " wallet");
            }
        }

        return Map.of("recoveryKey", recoveryKey);
    }

    public Map<String, String> login(LoginRequest request) {
        String username = request.getUsername();
        String password = request.getPassword();

        User user = userRepository.findByUsername(username).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_PASSWORD);
        }

        return Map.of("token", jwtTokenProvider.generateToken(user.getId()));
    }

    @Transactional
    public Map<String, String> recover(RecoverRequest request) {
        String recoveryKey = request.getRecoveryKey();
        String newUsername = request.getNewUsername();
        String newPassword = request.getNewPassword();

        RecoveryKeyProvider.KeyPair recoveryKeyPair = recoveryKeyProvider.recoveryKeyToKeyPair(recoveryKey);

        User user = userRepository.findByPublicRecoveryKey(recoveryKeyPair.publicKey()).orElseThrow(() -> new ApiException(ErrorCode.INVALID_RECOVERY_KEY));

        if (!passwordEncoder.matches(recoveryKeyPair.privateKey(), user.getPrivateRecoveryKeyHash())) {
            throw new ApiException(ErrorCode.INVALID_RECOVERY_KEY);
        }

        if (newUsername == null && newPassword == null) {
            throw new ApiException(ErrorCode.EMPTY_REQUEST);
        }

        if (newPassword != null) {
            passwordValidationService.validate(newPassword);
            user.setPasswordHash(passwordEncoder.encode(newPassword));
        }

        try {
            if (newUsername != null) user.setUsername(newUsername);
            userRepository.save(user);
        }
        catch (DataIntegrityViolationException e) { throw new ApiException(ErrorCode.USERNAME_TAKEN); }

        return Map.of("message", "recovered");
    }
}
