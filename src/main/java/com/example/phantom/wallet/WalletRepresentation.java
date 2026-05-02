package com.example.phantom.wallet;

import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter
@Setter
public class WalletRepresentation {
    private Long id;
    private BigDecimal balance;
    private BigDecimal depositsSum;
    private String depositAddress;
}
