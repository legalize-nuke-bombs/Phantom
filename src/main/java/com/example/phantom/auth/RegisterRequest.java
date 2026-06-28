package com.example.phantom.auth;

import com.example.phantom.captcha.CaptchaProof;
import com.example.phantom.user.PasswordValidationService;
import com.example.phantom.user.Role;
import com.example.phantom.user.UserConstants;
import jakarta.validation.Valid;
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
    @Size(min= PasswordValidationService.PASSWORD_MIN_LENGTH, max= PasswordValidationService.PASSWORD_MAX_LENGTH)
    private String password;

    private Long refId;

    @Size(max = 256)
    private String ownerKey;

    private Role role;

    @NotNull
    @Valid
    private CaptchaProof captcha;
}