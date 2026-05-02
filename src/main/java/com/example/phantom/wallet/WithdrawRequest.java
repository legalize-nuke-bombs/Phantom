package com.example.phantom.wallet;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter
@Setter
public class WithdrawRequest {
    @NotNull
    @Min(WalletConstants.WITHDRAW_MINIMAL_VALUE)
    private BigDecimal value;

    @NotNull
    @Size(min = WalletConstants.ADDRESS_LENGTH, max = WalletConstants.ADDRESS_LENGTH)
    @Pattern(regexp = WalletConstants.ADDRESS_PATTERN)
    private String address;
}
