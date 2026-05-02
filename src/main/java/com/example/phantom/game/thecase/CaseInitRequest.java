package com.example.phantom.game.thecase;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CaseInitRequest {
    @NotNull
    private String caseName;
}
