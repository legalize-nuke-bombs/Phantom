package com.example.phantom.owner;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequestMapping("/api/owner")
public class OwnerController {

    private final OwnerService service;

    public OwnerController(OwnerService service) {
        this.service = service;
    }

    @PostMapping("/change-user-role")
    public ResponseEntity<Map<String, String>> changeUserRole(@AuthenticationPrincipal Long userId, @Valid @RequestBody ChangeUserRoleRequest request) {
        return ResponseEntity.ok(service.changeUserRole(userId, request));
    }
}
