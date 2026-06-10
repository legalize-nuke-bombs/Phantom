package com.example.phantom.present;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ClaimPresentRequest {
    @NotNull
    private Long presentId;
}
