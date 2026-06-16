package com.example.phantom.owner;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.security.MessageDigest;
import java.util.Base64;

@Service
@Slf4j
public class OwnerAccessService {
    private final byte[] ownerKeyRaw;

    public OwnerAccessService(@Value("${owner.key}") String ownerKey) {
        try { this.ownerKeyRaw = Base64.getDecoder().decode(ownerKey); }
        catch (Exception e) { throw new RuntimeException("owner key must be encoded in base64"); }

        if (this.ownerKeyRaw.length < OwnerConstants.KEY_MIN_RAW_LENGTH) { throw new RuntimeException("owner key must be at least " + OwnerConstants.KEY_MIN_RAW_LENGTH + " bytes"); }
    }

    public boolean isOwner(String key) {
        if (key == null) return false;

        byte[] keyRaw;
        try { keyRaw = Base64.getDecoder().decode(key); }
        catch (Exception e) {
            log.info("malformed owner key specified");
            throw new ApiException(ErrorCode.OWNER_KEY_MALFORMED);
        }

        if (!MessageDigest.isEqual(keyRaw, ownerKeyRaw)) {
            log.info("invalid owner key specified");
            throw new ApiException(ErrorCode.OWNER_KEY_INVALID);
        }

        log.info("valid owner key specified");
        return true;
    }
}
