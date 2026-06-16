package com.example.phantom.auth;

import com.example.phantom.jwt.JwtAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final long expirationMs;

    public AuthController(AuthService authService, @Value("${jwt.expiration-ms}") long expirationMs) {
        this.authService = authService;
        this.expirationMs = expirationMs;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(
            @Valid @RequestBody RegisterRequest request,
            @RequestParam(required = false) Long refId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request, refId));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse response) {
        Map<String, String> result = authService.login(request);
        setTokenCookie(result.get("token"), httpRequest, response);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/recover")
    public ResponseEntity<Map<String, String>> recover(@Valid @RequestBody RecoverRequest request) {
        return ResponseEntity.ok(authService.recover(request));
    }

    private void setTokenCookie(String token, HttpServletRequest request, HttpServletResponse response) {
        if (token == null) {
            return;
        }
        ResponseCookie cookie = ResponseCookie.from(JwtAuthFilter.TOKEN_COOKIE, token)
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Lax")
                .path("/api")
                .maxAge(Duration.ofMillis(expirationMs))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
