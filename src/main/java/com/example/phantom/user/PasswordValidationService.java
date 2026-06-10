package com.example.phantom.user;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import org.springframework.stereotype.Service;

@Service
public class PasswordValidationService {

    public static final int PASSWORD_MIN_LENGTH = 8;
    public static final int PASSWORD_MAX_LENGTH = 40;

    public void validate(String password) {
        if (password == null || password.isBlank()
                || password.length() < PASSWORD_MIN_LENGTH
                || password.length() > PASSWORD_MAX_LENGTH) {
            throw new ApiException(ErrorCode.WEAK_PASSWORD);
        }

        boolean upper = false;
        boolean lower = false;
        boolean digit = false;
        boolean special = false;
        for (int i = 0; i < password.length(); i++) {
            char ch = password.charAt(i);
            if (Character.isUpperCase(ch)) upper = true;
            else if (Character.isLowerCase(ch)) lower = true;
            else if (Character.isDigit(ch)) digit = true;
            else special = true;
        }

        if (!upper || !lower || !digit || !special) {
            throw new ApiException(ErrorCode.WEAK_PASSWORD);
        }
    }
}
