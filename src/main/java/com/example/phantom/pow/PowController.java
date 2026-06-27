package com.example.phantom.pow;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pow")
public class PowController {

    private final PowService powService;

    public PowController(PowService powService) {
        this.powService = powService;
    }

    @GetMapping("/challenge")
    public Challenge challenge() {
        return powService.issue();
    }
}
