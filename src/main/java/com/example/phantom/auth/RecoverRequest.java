package com.example.phantom.auth;

import com.example.phantom.user.RecoveryKeyProvider;
import com.example.phantom.user.UserConstants;
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
    @Size(min = 2 * RecoveryKeyProvider.RECOVERY_KEY_PART_LENGTH, max = 2 * RecoveryKeyProvider.RECOVERY_KEY_PART_LENGTH)
    private String recoveryKey;

    @Size(min = UserConstants.USERNAME_MIN_LENGTH, max = UserConstants.USERNAME_MAX_LENGTH)
    @Pattern(regexp = UserConstants.USERNAME_PATTERN)
    private String newUsername;

    @Size(min = UserConstants.PASSWORD_MIN_LENGTH, max = UserConstants.PASSWORD_MAX_LENGTH)
    @Pattern(regexp = UserConstants.PASSWORD_PATTERN)
    private String newPassword1;

    @Size(max = UserConstants.PASSWORD_MAX_LENGTH)
    private String newPassword2;
}
