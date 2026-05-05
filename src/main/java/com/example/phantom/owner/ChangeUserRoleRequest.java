package com.example.phantom.owner;

import com.example.phantom.user.Role;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChangeUserRoleRequest {
    @NotNull
    private Long targetId;

    @NotNull
    private Role role;

    @Size(max = 255)
    private String ownerKey;
}
