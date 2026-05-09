package com.example.phantom.auth;

import com.example.phantom.crypto.ton.TonApiService;
import com.example.phantom.crypto.ton.TonWalletVersion;
import com.example.phantom.owner.OwnerAccessValidator;
import com.example.phantom.jwt.JwtTokenProvider;
import com.example.phantom.user.RecoveryKeyProvider;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import com.example.phantom.wallet.ton.TonWallet;
import com.example.phantom.wallet.ton.TonWalletRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.example.phantom.exception.*;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final TonWalletRepository tonWalletRepository;

    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final OwnerAccessValidator ownerAccessValidator;
    private final RecoveryKeyProvider recoveryKeyProvider;
    private final TonApiService tonApiService;

    public AuthService(UserRepository userRepository, WalletRepository walletRepository, TonWalletRepository tonWalletRepository, JwtTokenProvider jwtTokenProvider, PasswordEncoder passwordEncoder, OwnerAccessValidator ownerAccessValidator, RecoveryKeyProvider recoveryKeyProvider, TonApiService tonApiService) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.tonWalletRepository = tonWalletRepository;

        this.jwtTokenProvider = jwtTokenProvider;
        this.passwordEncoder = passwordEncoder;
        this.ownerAccessValidator = ownerAccessValidator;
        this.recoveryKeyProvider = recoveryKeyProvider;
        this.tonApiService = tonApiService;
    }

    @Transactional
    public Map<String, String> register(RegisterRequest request) {
        String username = request.getUsername();
        String displayName = request.getDisplayName();
        String password1 = request.getPassword1();
        String password2 = request.getPassword2();
        String adminKey = request.getOwnerKey();
        Role role = request.getRole();

        boolean isOwner = ownerAccessValidator.isOwner(adminKey);

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

        String publicRecoveryKey = recoveryKeyProvider.generatePart();
        String privateRecoveryKey = recoveryKeyProvider.generatePart();

        User user = new User();
        user.setUsername(username);
        user.setDisplayName(displayName);
        user.setRole(role);
        user.setPasswordHash(passwordEncoder.encode(password1));
        user.setPublicRecoveryKey(publicRecoveryKey);
        user.setPrivateRecoveryKeyHash(passwordEncoder.encode(privateRecoveryKey));
        try { user = userRepository.save(user); }
        catch (DataIntegrityViolationException e) { throw new ConflictException("username already exists"); }

        Wallet wallet = new Wallet();
        wallet.setUser(user);
        wallet.setBalance(BigDecimal.ZERO);
        wallet.setDepositsSum(BigDecimal.ZERO);
        walletRepository.save(wallet);

        try {
            String mnemonic = tonApiService.generateMnemonic();
            TonWalletVersion walletVersion = TonWalletVersion.V5;
            TonApiService.KeyPair keyPair = tonApiService.deriveKeyPair(mnemonic, walletVersion);

            TonWallet tonWallet = new TonWallet();
            tonWallet.setUser(user);
            tonWallet.setMnemonic(mnemonic);
            tonWallet.setWalletVersion(walletVersion);
            tonWallet.setAddress(keyPair.address());
            tonWallet.setPrivateKey(keyPair.privateKey());
            tonWalletRepository.save(tonWallet);
        }
        catch (Exception e) {
            throw new RuntimeException("failed to create ton wallet");
        }

        return Map.of("recoveryKey", publicRecoveryKey + privateRecoveryKey);
    }

    public Map<String, String> login(LoginRequest request) {
        String username = request.getUsername();
        String password = request.getPassword();

        User user = userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("username does not exist"));
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new UnauthorizedException("password is invalid");
        }

        return Map.of("token", jwtTokenProvider.generateToken(user.getId()));
    }

    @Transactional
    public Map<String, String> recover(RecoverRequest request) {
        String recoveryKey = request.getRecoveryKey();
        String newUsername = request.getNewUsername();
        String newPassword1 = request.getNewPassword1();
        String newPassword2 = request.getNewPassword2();

        String publicRecoveryKey = recoveryKey.substring(0, recoveryKey.length() / 2);
        String privateRecoveryKey = recoveryKey.substring(recoveryKey.length() / 2);

        User user = userRepository.findByPublicRecoveryKey(publicRecoveryKey).orElseThrow(() -> new UnauthorizedException("invalid recovery key"));

        if (!passwordEncoder.matches(privateRecoveryKey, user.getPrivateRecoveryKeyHash())) {
            throw new UnauthorizedException("invalid recovery key");
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

        if (newUsername != null) user.setUsername(newUsername);
        if (newPassword1 != null) user.setPasswordHash(passwordEncoder.encode(newPassword1));

        try { userRepository.save(user); }
        catch (DataIntegrityViolationException e) { throw new ConflictException("username already exists"); }

        return Map.of("message", "recovered");
    }
}