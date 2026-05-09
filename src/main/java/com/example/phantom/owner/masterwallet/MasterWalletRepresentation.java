package com.example.phantom.owner.masterwallet;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class MasterWalletRepresentation {
    private String address;
    private BigDecimal balance;
}
