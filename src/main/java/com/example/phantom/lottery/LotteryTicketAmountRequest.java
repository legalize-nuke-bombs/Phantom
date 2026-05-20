package com.example.phantom.lottery;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LotteryTicketAmountRequest {
    @NotNull
    @Min(1)
    private Long amount;
}
