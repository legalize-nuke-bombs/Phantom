package com.example.phantom.game;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GameRunRequest {
    @NotNull
    @Size(min=ProvablyFairProvider.SEED_LENGTH, max=ProvablyFairProvider.SEED_LENGTH)
    private String clientSeed;
}
