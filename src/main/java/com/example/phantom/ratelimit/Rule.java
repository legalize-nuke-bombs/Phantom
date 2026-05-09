package com.example.phantom.ratelimit;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class Rule {
    private final Long tokens;
    private final Long seconds;
}
