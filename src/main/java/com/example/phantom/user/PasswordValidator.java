package com.example.phantom.user;

import org.springframework.stereotype.Component;

@Component
public class PasswordValidator {

    public static final int PASSWORD_MIN_LENGTH = 8;
    public static final int PASSWORD_MAX_LENGTH = 40;

    public void validate(String password) throws PasswordValidatorException {
        if (password == null || password.isBlank()) {
            throw new PasswordValidatorException("password is blank");
        }

        if (password.length() < PASSWORD_MIN_LENGTH) {
            throw new PasswordValidatorException("password min length = " + PASSWORD_MIN_LENGTH);
        }

        if (password.length() > PASSWORD_MAX_LENGTH) {
            throw new PasswordValidatorException("password max length =" + PASSWORD_MAX_LENGTH);
        }

        boolean upperCaseFlag = false;
        boolean lowerCaseFlag = false;
        boolean digitFlag = false;
        boolean specialFlag = false;
        for (int i = 0; i < password.length(); i++) {
            char ch = password.charAt(i);
            if (Character.isUpperCase(ch)) {
                upperCaseFlag = true;
            }
            else if (Character.isLowerCase(ch)) {
                lowerCaseFlag = true;
            }
            else if (Character.isDigit(ch)) {
                digitFlag = true;
            }
            else {
                specialFlag = true;
            }
        }

        if (!upperCaseFlag) {
            throw new PasswordValidatorException("password must contain at least 1 upper case letter");
        }
        if (!lowerCaseFlag) {
            throw new PasswordValidatorException("password must contain at least 1 lower case letter");
        }
        if (!digitFlag) {
            throw new PasswordValidatorException("password must contain at least 1 digit");
        }
        if (!specialFlag) {
            throw new PasswordValidatorException("password must contain at least 1 special character");
        }
    }
}
