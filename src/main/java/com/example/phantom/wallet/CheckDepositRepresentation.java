package com.example.phantom.wallet;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CheckDepositRepresentation {
    private WalletRepresentation wallet;
    private TxDetails.TxStatus txStatus;
}
