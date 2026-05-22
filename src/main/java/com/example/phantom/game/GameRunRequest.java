package com.example.phantom.game;

import com.example.phantom.provablyfair.ProvablyFairService;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GameRunRequest {
    @NotNull
    @Size(min= ProvablyFairService.SEED_LENGTH, max= ProvablyFairService.SEED_LENGTH)
    private String clientSeed;
}
