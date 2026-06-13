package com.example.phantom.disk;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DiskQuota {
    private final long size;
    private final long files;
}
