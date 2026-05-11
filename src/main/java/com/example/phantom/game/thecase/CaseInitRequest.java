package com.example.phantom.game.thecase;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CaseInitRequest {
    @NotNull
    @Size(max=CaseConstants.CASE_NAME_MAX_LENGTH)
    private String caseName;
}
