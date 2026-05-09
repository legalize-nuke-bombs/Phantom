package com.example.phantom.ratelimit;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class State {
    private Long timestamp;
    private Long tokens;
}
