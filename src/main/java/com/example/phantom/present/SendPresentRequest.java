package com.example.phantom.present;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class SendPresentRequest {
    @NotNull
    @Min(PresentConstants.MIN_TO_SEND)
    private BigDecimal amount;

    @Size(max = PresentConstants.MAX_DESCRIPTION_LENGTH)
    private String description;

    @NotNull
    private Boolean anonymous;

    @NotNull
    private Long receiverId;
}
