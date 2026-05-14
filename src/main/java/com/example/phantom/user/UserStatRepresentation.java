package com.example.phantom.user;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserStatRepresentation {
    private final Long totalUsers;
    private final Long totalUsers24h;
}
