package com.example.phantom.user;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
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

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal Long userId, @Valid @RequestBody DeleteMeRequest request) {
        userService.deleteMe(userId, request);
        return ResponseEntity.noContent().build();
    }
}