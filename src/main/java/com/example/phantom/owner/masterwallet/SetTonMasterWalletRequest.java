package com.example.phantom.owner.masterwallet;

import com.example.phantom.ton.TonConstants;
import com.example.phantom.ton.TonWalletVersion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SetTonMasterWalletRequest {
    @NotNull
    @NotBlank
    @Size(max = TonConstants.MNEMONIC_MAX_LENGTH)
    private String mnemonic;

    @NotNull
    private TonWalletVersion walletVersion;
}
