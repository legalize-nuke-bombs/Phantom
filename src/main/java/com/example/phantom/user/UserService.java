package com.example.phantom.user;

import com.example.phantom.exception.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RecoveryKeyProvider recoveryKeyProvider;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, RecoveryKeyProvider recoveryKeyProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.recoveryKeyProvider = recoveryKeyProvider;
    }

    public UserStatRepresentation getStats() {
        long since24h = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();
        return new UserStatRepresentation(
                userRepository.countAll(),
                userRepository.countSince(since24h)
        );
    }

    public UserRepresentation getUserRepresentationById(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        return new UserRepresentation(user);
    }

    public UserRepresentation getUserRepresentationByUsername(String username) {
        User user = userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("user not found"));
        return new UserRepresentation(user);
    }

    @Transactional
    public Map<String, String> patchMe(Long userId, PatchMeRequest request) {
        String displayName = request.getDisplayName();

        if (displayName == null) {
            throw new BadRequestException("empty request");
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (displayName != null) user.setDisplayName(displayName);

        userRepository.save(user);

        return Map.of("message", "patched");
    }

    @Transactional
    public Map<String, String> patchMeSecure(Long userId, PatchMeSecureRequest request) {
        String currentPassword = request.getCurrentPassword();
        String username = request.getUsername();
        String password = request.getPassword();

        if (username == null && password == null) {
            throw new BadRequestException("empty request");
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ForbiddenException("invalid password");
        }

        if (password != null) user.setPasswordHash(passwordEncoder.encode(password));

        try {
            if (username != null) user.setUsername(username);
            userRepository.save(user);
        }
        catch (DataIntegrityViolationException e) {
            throw new ConflictException("username already exists");
        }

        return Map.of("message", "patched");
    }

    @Transactional
    public Map<String, String> newMyRecoveryKey(Long userId, PasswordRequest request) {
        String password = request.getPassword();

        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ForbiddenException("invalid password");
        }

        RecoveryKeyProvider.KeyPair recoveryKeyPair = recoveryKeyProvider.generateKeyPair();
        String recoveryKey;
        try { recoveryKey = recoveryKeyProvider.keyPairToRecoveryKey(recoveryKeyPair); }
        catch (BadRecoveryKey e) { throw new RuntimeException("failed to generate recovery key"); }

        user.setPublicRecoveryKey(recoveryKeyPair.publicKey());
        user.setPrivateRecoveryKeyHash(passwordEncoder.encode(recoveryKeyPair.privateKey()));
        userRepository.save(user);

        return Map.of("recoveryKey", recoveryKey);
    }

    @Transactional
    public void deleteMe(Long userId, PasswordRequest request) {
        String password = request.getPassword();

        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ForbiddenException("invalid password");
        }

        userRepository.delete(user);
    }
}
