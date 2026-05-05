package com.example.phantom.auth;

import com.example.phantom.owner.OwnerConstants;
import com.example.phantom.user.Role;
import com.example.phantom.user.UserConstants;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {
    @NotNull
    @Size(min= UserConstants.USERNAME_MIN_LENGTH, max= UserConstants.USERNAME_MAX_LENGTH)
    @Pattern(regexp= UserConstants.USERNAME_PATTERN)
    private String username;

    @NotNull
    @Size(min= UserConstants.DISPLAY_NAME_MIN_LENGTH, max= UserConstants.DISPLAY_NAME_MAX_LENGTH)
    private String displayName;

    @NotNull
    @Size(min= UserConstants.PASSWORD_MIN_LENGTH, max= UserConstants.PASSWORD_MAX_LENGTH)
    @Pattern(regexp= UserConstants.PASSWORD_PATTERN)
    private String password1;

    @NotNull
    @Size(max= UserConstants.PASSWORD_MAX_LENGTH)
    private String password2;

    @Size(max = 256)
    private String ownerKey;

    private Role role;
}