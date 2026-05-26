package com.example.phantom.wallet;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class SendRequest {
    @NotNull
    @Min(WalletConstants.MIN_TO_SEND)
    private BigDecimal amount;
}
