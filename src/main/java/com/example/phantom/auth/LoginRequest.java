package com.example.phantom.auth;

import com.example.phantom.user.UserConstants;
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
    @Size(max= UserConstants.PASSWORD_MAX_LENGTH)
    private String password;
}