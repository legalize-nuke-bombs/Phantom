package com.example.phantom.owner;

import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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

    @DeleteMapping("/delete-user")
    public ResponseEntity<Void> deleteUser(@AuthenticationPrincipal Long userId, @Valid @RequestBody DeleteUserRequest request) {
        service.deleteUser(userId, request);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @GetMapping("/withdrawals/history")
    public ResponseEntity<List<WithdrawalRepresentation>> getWithdrawalHistory(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return ResponseEntity.ok(service.getWithdrawalHistory(userId, limit, before));
    }

}
