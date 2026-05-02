package com.example.phantom.wallet;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class WithdrawalCheckRepresentation {
    private WalletRepresentation wallet;
    private List<WithdrawalRepresentation> withdrawals;
}
