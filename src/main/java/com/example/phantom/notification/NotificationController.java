package com.example.phantom.notification;

import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@Validated
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<NotificationRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "true") Boolean notReadOnly,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit
    ) {
        return notificationService.get(userId, notReadOnly, before, limit);
    }

    @PostMapping("/read")
    public Void read(@AuthenticationPrincipal Long userId, @RequestBody @Validated ReadNotificationsRequest request) {
        return notificationService.read(userId, request);
    }
}
