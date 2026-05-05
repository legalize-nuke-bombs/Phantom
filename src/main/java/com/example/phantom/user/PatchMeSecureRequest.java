package com.example.phantom.user;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PatchMeSecureRequest {
    @NotNull
    @Size(max = UserConstants.PASSWORD_MAX_LENGTH)
    private String currentPassword;

    @Size(min= UserConstants.USERNAME_MIN_LENGTH, max= UserConstants.USERNAME_MAX_LENGTH)
    @Pattern(regexp= UserConstants.USERNAME_PATTERN)
    private String username;

    @Size(min= UserConstants.PASSWORD_MIN_LENGTH, max= UserConstants.PASSWORD_MAX_LENGTH)
    @Pattern(regexp= UserConstants.PASSWORD_PATTERN)
    private String password;
}
