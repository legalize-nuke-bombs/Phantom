package com.example.phantom.owner;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.UnauthorizedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.security.MessageDigest;
import java.util.Base64;

@Component
public class OwnerAccessValidator {
    private final byte[] ownerKeyRaw;

    public OwnerAccessValidator(@Value("${owner.key}") String ownerKey) {
        try { this.ownerKeyRaw = Base64.getDecoder().decode(ownerKey); }
        catch (Exception e) { throw new RuntimeException("owner key must be encoded in base64"); }

        if (this.ownerKeyRaw.length < OwnerConstants.KEY_MIN_RAW_LENGTH) { throw new RuntimeException("owner key must be at least " + OwnerConstants.KEY_MIN_RAW_LENGTH + " bytes"); }
    }

    public boolean isOwner(String key) {
        if (key == null) return false;

        byte[] keyRaw;
        try { keyRaw = Base64.getDecoder().decode(key); }
        catch (Exception e) { throw new BadRequestException("owner key must be encoded in base64"); }

        if (!MessageDigest.isEqual(keyRaw, ownerKeyRaw)) { // constant time method to prevent timing attack
            throw new UnauthorizedException("invalid owner key");
        }

        return true;
    }
}
