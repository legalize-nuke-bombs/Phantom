package com.example.phantom.game.upgrader;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter
@Setter
public class UpgraderInitRequest {
    @NotNull
    @Positive
    private BigDecimal bet;

    @NotNull
    @Min(0)
    @Max(100)
    private Integer percent;
}
