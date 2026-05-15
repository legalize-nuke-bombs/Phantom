package com.example.phantom.wallet;

import com.example.phantom.wallet.balancechange.BalanceChangeConstants;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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

    @Size(max = BalanceChangeConstants.MAX_DETAILS_LENGTH)
    private String message;
}
