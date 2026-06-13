package com.example.phantom.disk.favourite;

import com.example.phantom.disk.FileRepresentation;
import com.example.phantom.disk.FileIdRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Validated
@RequestMapping("/api/disk/favourites")
public class DiskFavouritesController {

    private final DiskFavouritesService diskFavouritesService;

    public DiskFavouritesController(DiskFavouritesService diskFavouritesService) {
        this.diskFavouritesService = diskFavouritesService;
    }

    @GetMapping
    public List<FavouriteFileRepresentation> get(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") Integer limit
    ) {
        return diskFavouritesService.get(userId, before, limit);
    }

    @PostMapping
    public Void post(@AuthenticationPrincipal Long userId, @RequestBody @Valid FileIdRequest request) {
        return diskFavouritesService.post(userId, request);
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long userId, @RequestBody @Valid FileIdRequest request) {
        diskFavouritesService.delete(userId, request);
        return ResponseEntity.noContent().build();
    }
}
