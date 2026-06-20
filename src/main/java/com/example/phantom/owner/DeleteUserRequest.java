package com.example.phantom.owner;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DeleteUserRequest {
    @NotNull
    private Long targetId;

    @Size(max = 255)
    private String ownerKey;
}
