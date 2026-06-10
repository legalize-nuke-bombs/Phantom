package com.example.phantom.user;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
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
    private final PasswordValidationService passwordValidationService;
    private final RecoveryKeyService recoveryKeyService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, PasswordValidationService passwordValidationService, RecoveryKeyService recoveryKeyService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordValidationService = passwordValidationService;
        this.recoveryKeyService = recoveryKeyService;
    }

    public UserStatRepresentation getStats() {
        long since24h = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();
        return new UserStatRepresentation(
                userRepository.countAll(),
                userRepository.countSince(since24h)
        );
    }

    public UserFullRepresentation getUserFullRepresentationById(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        return new UserFullRepresentation(user);
    }

    public UserFullRepresentation getUserFullRepresentationByUsername(String username) {
        User user = userRepository.findByUsername(username).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        return new UserFullRepresentation(user);
    }

    @Transactional
    public Map<String, String> patchMe(Long userId, PatchMeRequest request) {
        String displayName = request.getDisplayName();
        PrivacySetting gameHistoryPrivacySetting = request.getGameHistoryPrivacySetting();
        PrivacySetting gameStatsPrivacySetting = request.getGameStatsPrivacySetting();
        PrivacySetting experiencePrivacySetting = request.getExperiencePrivacySetting();
        PrivacySetting lotteryPrivacySetting = request.getLotteryPrivacySetting();

        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        if (displayName != null) user.setDisplayName(displayName);
        if (gameHistoryPrivacySetting != null) user.setGameHistoryPrivacySetting(gameHistoryPrivacySetting);
        if (gameStatsPrivacySetting != null) user.setGameStatsPrivacySetting(gameStatsPrivacySetting);
        if (experiencePrivacySetting != null) user.setExperiencePrivacySetting(experiencePrivacySetting);
        if (lotteryPrivacySetting != null) user.setLotteryPrivacySetting(lotteryPrivacySetting);

        userRepository.save(user);

        return Map.of("message", "patched");
    }

    @Transactional
    public Map<String, String> patchMeSecure(Long userId, PatchMeSecureRequest request) {
        String currentPassword = request.getCurrentPassword();
        String username = request.getUsername();
        String password = request.getPassword();

        if (username == null && password == null) {
            throw new ApiException(ErrorCode.EMPTY_REQUEST);
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_PASSWORD);
        }

        if (password != null) {
            passwordValidationService.validate(password);
            user.setPasswordHash(passwordEncoder.encode(password));
        }

        try {
            if (username != null) user.setUsername(username);
            userRepository.save(user);
        }
        catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.USERNAME_TAKEN);
        }

        return Map.of("message", "patched");
    }

    @Transactional
    public Map<String, String> newMyRecoveryKey(Long userId, PasswordRequest request) {
        String password = request.getPassword();

        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_PASSWORD);
        }

        RecoveryKeyService.KeyPair recoveryKeyPair = recoveryKeyService.generateKeyPair();
        String recoveryKey = recoveryKeyService.keyPairToRecoveryKey(recoveryKeyPair);

        user.setPublicRecoveryKey(recoveryKeyPair.publicKey());
        user.setPrivateRecoveryKeyHash(passwordEncoder.encode(recoveryKeyPair.privateKey()));
        userRepository.save(user);

        return Map.of("recoveryKey", recoveryKey);
    }

    @Transactional
    public void deleteMe(Long userId, PasswordRequest request) {
        String password = request.getPassword();

        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_PASSWORD);
        }

        userRepository.delete(user);
    }
}
