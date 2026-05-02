package com.example.phantom.auth;

import com.example.phantom.security.JwtTokenProvider;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.example.phantom.exception.*;
import org.tron.trident.core.key.KeyPair;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, WalletRepository walletRepository, JwtTokenProvider jwtTokenProvider, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.jwtTokenProvider = jwtTokenProvider;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Map<String, String> register(RegisterRequest request) {
        String username = request.getUsername();
        String displayName = request.getDisplayName();
        String password1 = request.getPassword1();
        String password2 = request.getPassword2();

        if (!Objects.equals(password1, password2)) {
            throw new BadRequestException("passwords do not match");
        }

        User user = new User();
        user.setUsername(username);
        user.setDisplayName(displayName);
        user.setPasswordHash(passwordEncoder.encode(password1));

        try {
            userRepository.save(user);
        }
        catch (DataIntegrityViolationException e) {
            throw new ConflictException("username already exists");
        }

        KeyPair keyPair = KeyPair.generate();
        String address = keyPair.toBase58CheckAddress();
        String privateKey = keyPair.toPrivateKey();

        Wallet wallet = new Wallet();
        wallet.setUser(user);
        wallet.setBalance(BigDecimal.ZERO);
        wallet.setDepositsSum(BigDecimal.ZERO);
        wallet.setDepositAddress(address);
        wallet.setDepositPrivateKey(privateKey);

        walletRepository.save(wallet);

        return Map.of("message", "registered");
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
}