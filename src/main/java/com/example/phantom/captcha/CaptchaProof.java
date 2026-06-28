package com.example.phantom.captcha;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CaptchaProof(
        @NotNull @Pattern(regexp = "[0-9a-f]{32}") String id,
        @NotNull @Size(max = CaptchaConstants.ANSWER_MAX_LENGTH) String answer
) {
}
