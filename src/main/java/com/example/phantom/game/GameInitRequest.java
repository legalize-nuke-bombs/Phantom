package com.example.phantom.game;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class GameInitRequest {
    @NotNull
    private Map<String, String> data;
}
