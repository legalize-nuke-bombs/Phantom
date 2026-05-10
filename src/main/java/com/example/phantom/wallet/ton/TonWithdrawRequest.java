package com.example.phantom.wallet.ton;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class TonWithdrawRequest {
    @NotNull
    @Size(min = TonConstants.ADDRESS_LENGTH, max = TonConstants.ADDRESS_LENGTH)
    @Pattern(regexp = TonConstants.ADDRESS_PATTERN)
    private String address;

    @NotNull
    @Min(TonConstants.MIN_WITHDRAWAL)
    private BigDecimal amount;
}
