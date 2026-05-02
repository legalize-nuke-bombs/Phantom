package com.example.phantom.user;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PatchMeRequest {
    @Size(min=UserValidationConstants.DISPLAY_NAME_MIN_LENGTH, max=UserValidationConstants.DISPLAY_NAME_MAX_LENGTH)
    private String displayName;
}
