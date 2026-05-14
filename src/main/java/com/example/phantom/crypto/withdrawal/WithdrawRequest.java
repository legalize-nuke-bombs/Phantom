package com.example.phantom.crypto.withdrawal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class WithdrawRequest {
    @NotNull
    @NotBlank
    private String address;

    @NotNull
    @Positive
    private BigDecimal amount;
}
