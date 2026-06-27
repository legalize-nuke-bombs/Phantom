package com.example.phantom.auth;

import com.example.phantom.pow.PowProof;
import com.example.phantom.user.PasswordValidationService;
import com.example.phantom.user.RecoveryKeyService;
import com.example.phantom.user.UserConstants;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RecoverRequest {
    @NotNull
    @Size(min = RecoveryKeyService.RECOVERY_KEY_LENGTH, max = RecoveryKeyService.RECOVERY_KEY_LENGTH)
    private String recoveryKey;

    @Size(min = UserConstants.USERNAME_MIN_LENGTH, max = UserConstants.USERNAME_MAX_LENGTH)
    @Pattern(regexp = UserConstants.USERNAME_PATTERN)
    private String newUsername;

    @Size(min = PasswordValidationService.PASSWORD_MIN_LENGTH, max = PasswordValidationService.PASSWORD_MAX_LENGTH)
    private String newPassword;

    @NotNull
    @Valid
    private PowProof pow;
}
