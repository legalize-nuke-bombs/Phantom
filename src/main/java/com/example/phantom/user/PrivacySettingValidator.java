package com.example.phantom.user;

import com.example.phantom.exception.ForbiddenException;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class PrivacySettingValidator {

    public void validate(Long user1Id, Long user2Id, PrivacySetting setting) {
        if (!ok(user1Id, user2Id, setting)) {
            throw new ForbiddenException("user hid this information");
        }
    }

    private boolean ok(Long user1Id, Long user2Id, PrivacySetting setting) {
        return switch(setting) {
            case EVERYONE -> true;
            case ONLY_YOU -> Objects.equals(user1Id, user2Id);
        };
    }
}
