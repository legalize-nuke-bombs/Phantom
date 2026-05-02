package com.example.phantom.user;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PatchMeSecureRequest {
    @NotNull
    private String currentPassword;

    @Size(min=UserValidationConstants.USERNAME_MIN_LENGTH, max=UserValidationConstants.USERNAME_MAX_LENGTH)
    @Pattern(regexp=UserValidationConstants.USERNAME_PATTERN)
    private String username;

    @Size(min=UserValidationConstants.PASSWORD_MIN_LENGTH, max=UserValidationConstants.PASSWORD_MAX_LENGTH)
    @Pattern(regexp=UserValidationConstants.PASSWORD_PATTERN)
    private String password;
}
