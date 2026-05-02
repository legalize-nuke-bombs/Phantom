package com.example.phantom.auth;

import com.example.phantom.user.UserValidationConstants;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {
    @NotNull
    @Size(min=UserValidationConstants.USERNAME_MIN_LENGTH, max=UserValidationConstants.USERNAME_MAX_LENGTH)
    @Pattern(regexp=UserValidationConstants.USERNAME_PATTERN)
    private String username;

    @NotNull
    @Size(min=UserValidationConstants.DISPLAY_NAME_MIN_LENGTH, max=UserValidationConstants.DISPLAY_NAME_MAX_LENGTH)
    private String displayName;

    @NotNull
    @Size(min=UserValidationConstants.PASSWORD_MIN_LENGTH, max=UserValidationConstants.PASSWORD_MAX_LENGTH)
    @Pattern(regexp=UserValidationConstants.PASSWORD_PATTERN)
    private String password1;

    @NotNull
    private String password2;
}