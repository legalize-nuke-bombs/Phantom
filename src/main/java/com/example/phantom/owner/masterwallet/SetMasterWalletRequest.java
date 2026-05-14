package com.example.phantom.owner.masterwallet;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SetMasterWalletRequest {
    @NotNull
    @NotBlank
    @Size(max = 500)
    private String mnemonic;
}
