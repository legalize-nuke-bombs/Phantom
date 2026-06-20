package com.example.phantom.owner;

import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoleClaimedRepresentation {
    private final UserShortRepresentation user;
    private final Role role;

    public RoleClaimedRepresentation(User user, Role role) {
        this.user = new UserShortRepresentation(user);
        this.role = role;
    }
}
