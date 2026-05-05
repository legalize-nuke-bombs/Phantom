package com.example.phantom.owner.sweep;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SetScheduleRequest {
    @NotNull
    @Min(SweepConstants.MIN_DELAY)
    @Max(SweepConstants.MAX_DELAY)
    private Long seconds;
}
