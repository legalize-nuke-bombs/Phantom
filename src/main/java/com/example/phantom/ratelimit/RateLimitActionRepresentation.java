package com.example.phantom.ratelimit;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RateLimitActionRepresentation {
    private Long timestamp;
    private Long seconds;
    private Long tokensSpent;
    private Long tokensTotal;
}
