package com.example.phantom.user;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    public UserController(UserService userService, UserRepository userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<UserRepresentation> getMe(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(userService.getUserRepresentationById(userId));
    }

    @GetMapping("/by-id/{userId}")
    public ResponseEntity<UserRepresentation> getById(@PathVariable Long userId) {
        return ResponseEntity.ok(userService.getUserRepresentationById(userId));
    }

    @GetMapping("/by-username/{username}")
    public ResponseEntity<UserRepresentation> getByUsername(@PathVariable String username) {
        return ResponseEntity.ok(userService.getUserRepresentationByUsername(username));
    }

    @PatchMapping("/me")
    public ResponseEntity<Map<String, String>> patchMe(@AuthenticationPrincipal Long userId, @Valid @RequestBody PatchMeRequest request) {
        return ResponseEntity.ok(userService.patchMe(userId, request));
    }

    @PatchMapping("/me/secure")
    public ResponseEntity<Map<String, String>> patchMeSecure(@AuthenticationPrincipal Long userId, @Valid @RequestBody PatchMeSecureRequest request) {
        return ResponseEntity.ok(userService.patchMeSecure(userId, request));
    }

    @PostMapping("/me/new-recovery-key")
    public ResponseEntity<Map<String, String>> neyMyRecoveryKey(@AuthenticationPrincipal Long userId, @Valid @RequestBody PasswordRequest passwordRequest) {
        return ResponseEntity.ok(userService.newMyRecoveryKey(userId, passwordRequest));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal Long userId, @Valid @RequestBody PasswordRequest request) {
        userService.deleteMe(userId, request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<UserStatRepresentation> stats() {
        long since24h = Instant.now().getEpochSecond() - 86400;
        return ResponseEntity.ok(new UserStatRepresentation(
                userRepository.countAll(),
                userRepository.countSince(since24h)
        ));
    }
}