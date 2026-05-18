package com.example.phantom.privacysetting;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/privacy-settings")
public class PrivacySettingController {

    private final PrivacySettingService service;

    public PrivacySettingController(PrivacySettingService service) {
        this.service = service;
    }

    @GetMapping("/{targetId}")
    public ResponseEntity<PrivacySettingRepresentation> get(@PathVariable Long targetId) {
        return ResponseEntity.ok(service.get(targetId));
    }

    @PatchMapping("/me")
    public ResponseEntity<Map<String, String>> patchMe(@AuthenticationPrincipal Long userId, @Valid @RequestBody PatchMyPrivacySettingsRequest request) {
        return ResponseEntity.ok(service.patchMe(userId, request));
    }
}
