package com.example.phantom.ref;

import com.example.phantom.user.UserShortRepresentation;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Validated
@RequestMapping("/api/ref")
public class RefController {

    private final RefService refService;

    public RefController(RefService refService) {
        this.refService = refService;
    }

    @GetMapping("/members")
    public List<UserShortRepresentation> getRefMembers(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") @Min(1) Integer limit,
            @RequestParam(required = false) Long before
    ) {
        return refService.getRefMembers(userId, limit, before);
    }

    @GetMapping
    public RefStorageRepresentation get(@AuthenticationPrincipal Long userId) {
        return refService.getRefStorage(userId);
    }

    @PostMapping("/claim")
    public RefStorageRepresentation claim(@AuthenticationPrincipal Long userId) {
        return refService.claim(userId);
    }
}
