package com.example.phantom.jwt;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/jwt")
public class JwtController {

    private final JwtTokenProvider jwtTokenProvider;

    public JwtController(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @GetMapping
    public ResponseEntity<Map<String, String>> get(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(Map.of("token", jwtTokenProvider.generateToken(userId)));
    }
}
