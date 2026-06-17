package com.example.phantom.broadcast;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class BroadcastRequest {
    @NotNull
    @Size(max = BroadcastConstants.MAX_CONTENT_SIZE)
    private String content;
}
