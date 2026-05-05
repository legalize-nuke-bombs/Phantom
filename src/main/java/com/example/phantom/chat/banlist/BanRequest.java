package com.example.phantom.chat.banlist;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class BanRequest {
    @NotNull
    @NotBlank
    @Size(max = BanlistConstants.MAX_REASON_LENGTH)
    private String reason;

    @NotNull
    @Positive
    private Long duration;
}
