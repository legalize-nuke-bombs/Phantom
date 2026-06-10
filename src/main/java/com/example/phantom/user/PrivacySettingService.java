package com.example.phantom.user;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public class PrivacySettingService {

    public void validate(Long user1Id, Long user2Id, PrivacySetting setting) {
        if (!isVisible(user1Id, user2Id, setting)) {
            throw new ApiException(ErrorCode.INFO_HIDDEN);
        }
    }

    public boolean isVisible(Long user1Id, Long user2Id, PrivacySetting setting) {
        return switch(setting) {
            case EVERYONE -> true;
            case ONLY_YOU -> Objects.equals(user1Id, user2Id);
        };
    }
}
