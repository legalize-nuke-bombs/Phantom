package com.example.phantom.disk;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;


@RestController
@Validated
@RequestMapping("/api/disk")
public class DiskController {

    private final DiskService diskService;

    public DiskController(DiskService diskService) {
        this.diskService = diskService;
    }

    @GetMapping("/settings")
    public DiskSettings getSettings() {
        return diskService.getSettings();
    }

    @GetMapping("/files")
    public List<FileRepresentation> getFiles(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") Integer limit
    ) {
        return diskService.getFiles(userId, before, limit);
    }

    @PostMapping("/files")
    public FileRepresentation upload(@AuthenticationPrincipal Long userId,
                                     @RequestParam("file") MultipartFile file) {
        return diskService.upload(userId, file);
    }

    @GetMapping("/files/{id}")
    public ResponseEntity<Resource> download(@AuthenticationPrincipal Long userId, @PathVariable UUID id) {
        DiskService.Download download = diskService.download(userId, id);

        String guessed = URLConnection.guessContentTypeFromName(download.name());
        MediaType contentType = guessed != null ? MediaType.parseMediaType(guessed) : MediaType.APPLICATION_OCTET_STREAM;
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.name(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(contentType)
                .contentLength(download.size())
                .body(download.resource());
    }

    @DeleteMapping("/files/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long userId, @PathVariable UUID id) {
        diskService.delete(userId, id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
