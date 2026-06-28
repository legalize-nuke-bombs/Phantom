package com.example.phantom.captcha;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CaptchaProof(
        @NotNull @Size(max = CaptchaConstants.TOKEN_MAX_LENGTH) String id,
        @NotNull @Size(max = CaptchaConstants.ANSWER_MAX_LENGTH) String answer
) {
}
