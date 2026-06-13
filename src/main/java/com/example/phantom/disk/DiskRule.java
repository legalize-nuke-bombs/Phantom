package com.example.phantom.disk;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DiskRule {
    private final long maxSize;
    private final long maxFiles;
    private final long maxFavourites;
}
