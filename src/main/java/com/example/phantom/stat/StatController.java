package com.example.phantom.stat;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stats")
public class StatController {

    private final StatService service;

    public StatController(StatService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<StatRepresentation> get() {
        return ResponseEntity.ok(service.get());
    }
}
