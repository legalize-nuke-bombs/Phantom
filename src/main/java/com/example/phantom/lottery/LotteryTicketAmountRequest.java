package com.example.phantom.lottery;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LotteryTicketAmountRequest {
    @Min(1)
    private Long amount;
}
