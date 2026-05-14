package com.example.phantom.auth;

import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CoinProviderRegistry;
import com.example.phantom.crypto.CryptoWallet;
import com.example.phantom.crypto.CryptoWalletRepository;
import com.example.phantom.owner.OwnerAccessDenied;
import com.example.phantom.owner.OwnerAccessValidator;
import com.example.phantom.owner.OwnerBadAccess;
import com.example.phantom.user.*;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.example.phantom.exception.*;
import java.util.Map;
import java.util.Objects;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final CryptoWalletRepository cryptoWalletRepository;

    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final OwnerAccessValidator ownerAccessValidator;
    private final RecoveryKeyProvider recoveryKeyProvider;
    private final CoinProviderRegistry coinProviderRegistry;

    public AuthService(UserRepository userRepository, WalletRepository walletRepository, CryptoWalletRepository cryptoWalletRepository, JwtTokenProvider jwtTokenProvider, PasswordEncoder passwordEncoder, OwnerAccessValidator ownerAccessValidator, RecoveryKeyProvider recoveryKeyProvider, CoinProviderRegistry coinProviderRegistry) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.cryptoWalletRepository = cryptoWalletRepository;

        this.jwtTokenProvider = jwtTokenProvider;
        this.passwordEncoder = passwordEncoder;
        this.ownerAccessValidator = ownerAccessValidator;
        this.recoveryKeyProvider = recoveryKeyProvider;
        this.coinProviderRegistry = coinProviderRegistry;
    }

    @Transactional
    public Map<String, String> register(RegisterRequest request) {
        String username = request.getUsername();
        String displayName = request.getDisplayName();
        String password1 = request.getPassword1();
        String password2 = request.getPassword2();
        String adminKey = request.getOwnerKey();
        Role role = request.getRole();

        boolean isOwner;
        try { isOwner = ownerAccessValidator.isOwner(adminKey); }
        catch (OwnerBadAccess e) { throw new BadRequestException(e.getMessage()); }
        catch (OwnerAccessDenied e) { throw new ForbiddenException(e.getMessage()); }

        if (!isOwner && role != null) {
            throw new ForbiddenException("owner key not specified");
        }
        if (isOwner && role == null) {
            throw new BadRequestException("role not specified");
        }

        if (role == null) {
            role = Role.USER;
        }

        if (!Objects.equals(password1, password2)) {
            throw new BadRequestException("passwords do not match");
        }

        RecoveryKeyProvider.KeyPair recoveryKeyPair = recoveryKeyProvider.generateKeyPair();
        String recoveryKey;
        try { recoveryKey = recoveryKeyProvider.keyPairToRecoveryKey(recoveryKeyPair); }
        catch (BadRecoveryKey e) { throw new RuntimeException("failed to generate recovery key"); }

        User user = new User();
        user.setUsername(username);
        user.setDisplayName(displayName);
        user.setRole(role);
        user.setPasswordHash(passwordEncoder.encode(password1));
        user.setPublicRecoveryKey(recoveryKeyPair.publicKey());
        user.setPrivateRecoveryKeyHash(passwordEncoder.encode(recoveryKeyPair.privateKey()));
        try { user = userRepository.save(user); }
        catch (DataIntegrityViolationException e) { throw new ConflictException("username already exists"); }

        Wallet wallet = new Wallet();
        wallet.setUser(user);
        walletRepository.save(wallet);

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

        User user = userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("username does not exist"));
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ForbiddenException("password is invalid");
        }

        return Map.of("token", jwtTokenProvider.generateToken(user.getId()));
    }

    @Transactional
    public Map<String, String> recover(RecoverRequest request) {
        String recoveryKey = request.getRecoveryKey();
        String newUsername = request.getNewUsername();
        String newPassword1 = request.getNewPassword1();
        String newPassword2 = request.getNewPassword2();

        RecoveryKeyProvider.KeyPair recoveryKeyPair;
        try { recoveryKeyPair = recoveryKeyProvider.recoveryKeyToKeyPair(recoveryKey); }
        catch (BadRecoveryKey e) { throw new BadRequestException("bad recovery key"); }

        User user = userRepository.findByPublicRecoveryKey(recoveryKeyPair.publicKey()).orElseThrow(() -> new ForbiddenException("invalid recovery key"));

        if (!passwordEncoder.matches(recoveryKeyPair.privateKey(), user.getPrivateRecoveryKeyHash())) {
            throw new ForbiddenException("invalid recovery key");
        }

        if (newUsername == null && newPassword1 == null) {
            throw new BadRequestException("empty request");
        }

        if (newPassword1 != null) {
            if (newPassword2 == null) {
                throw new BadRequestException("newPassword2 is null");
            }
            if (!newPassword1.equals(newPassword2)) {
                throw new BadRequestException("passwords do not match");
            }
        }

        if (newPassword1 != null) user.setPasswordHash(passwordEncoder.encode(newPassword1));

        try {
            if (newUsername != null) user.setUsername(newUsername);
            userRepository.save(user);
        }
        catch (DataIntegrityViolationException e) { throw new ConflictException("username already exists"); }

        return Map.of("message", "recovered");
    }
}