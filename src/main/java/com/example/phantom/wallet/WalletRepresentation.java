package com.example.phantom.wallet;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class WalletRepresentation {
    private BigDecimal balance;
    private BigDecimal depositsSum;
}
