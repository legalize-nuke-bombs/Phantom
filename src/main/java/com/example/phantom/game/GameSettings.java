package com.example.phantom.game;

import lombok.Getter;
import org.springframework.stereotype.Component;
import java.util.List;

@Getter
@Component
public class GameSettings {
    private final List<String> games = List.of(
            "upgrader",
            "cases"
    );
}
