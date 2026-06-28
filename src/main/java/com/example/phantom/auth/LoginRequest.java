package com.example.phantom.auth;

import com.example.phantom.captcha.CaptchaProof;
import com.example.phantom.user.PasswordValidationService;
import com.example.phantom.user.UserConstants;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {
    @NotNull
    @Size(max= UserConstants.USERNAME_MAX_LENGTH)
    private String username;

    @NotNull
    @Size(max= PasswordValidationService.PASSWORD_MAX_LENGTH)
    private String password;

    @NotNull
    @Valid
    private CaptchaProof captcha;
}