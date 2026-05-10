package com.example.phantom.ratelimit;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class RateLimitRepresentation {
    private Map<String, RateLimitActionRepresentation> data;
}
