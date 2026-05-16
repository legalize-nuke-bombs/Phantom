package com.example.phantom.game.util.slot;

import java.util.Random;

public interface Slots {
    void registerSlot(Slot slot);
    void registerPattern(Pattern pattern);

    void validate();

    SpinRepresentation spin(Random random);

    void estimate(int spins);
}
