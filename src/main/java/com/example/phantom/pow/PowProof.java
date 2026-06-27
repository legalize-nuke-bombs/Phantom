package com.example.phantom.pow;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record PowProof(
        @NotNull @Pattern(regexp = "[0-9a-f]{32}") String salt,
        long ts,
        @NotNull @Pattern(regexp = "[0-9a-f]{64}") String sig,
        @NotNull @Pattern(regexp = "[0-9]{1,20}") String nonce
) {
}
