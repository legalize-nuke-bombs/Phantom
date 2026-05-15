package com.example.phantom.wallet;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class PersonalWalletStatRepresentation {
    private final BigDecimal totalDeposits;
}
