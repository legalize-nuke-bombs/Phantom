package com.example.phantom.disk;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AdvancedFileRepresentation {
    private final FileRepresentation file;
    private final long refs;
}
