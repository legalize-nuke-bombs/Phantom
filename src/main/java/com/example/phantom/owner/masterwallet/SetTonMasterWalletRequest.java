package com.example.phantom.owner.masterwallet;

import com.example.phantom.crypto.ton.TonApiService;
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
    @Size(max = 255)
    private String mnemonic;

    @NotNull
    private TonApiService.WalletVersion walletVersion;
}
