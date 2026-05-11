package com.example.phantom.usagelimit;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UsageLimitRule {
    private final Long tokens;
    private final Long seconds;
}
