package com.example.phantom.chat.blacklist;

import com.example.phantom.user.UserShortRepresentation;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class BlacklistRepresentation {
    private final List<UserShortRepresentation> users;
}
