package com.example.phantom.usagelimit;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UsageLimitActionRepresentation {
    private Long timestamp;
    private Long seconds;
    private Long tokensSpent;
    private Long tokensTotal;
}
