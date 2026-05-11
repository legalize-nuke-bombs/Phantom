package com.example.phantom.usagelimit;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class UsageLimitRepresentation {
    private Map<String, UsageLimitActionRepresentation> data;
}
