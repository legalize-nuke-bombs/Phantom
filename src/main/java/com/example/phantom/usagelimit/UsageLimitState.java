package com.example.phantom.usagelimit;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class UsageLimitState {
    private Long timestamp;
    private Long tokens;
}
