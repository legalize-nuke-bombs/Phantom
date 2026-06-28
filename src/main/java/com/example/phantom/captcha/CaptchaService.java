package com.example.phantom.captcha;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class CaptchaService {

    private static final int GCM_TAG_BITS = 128;
    private static final int IV_LENGTH = 12;

    private final SecureRandom random = new SecureRandom();
    private final SecretKeySpec key;
    private final Map<String, Long> consumed = new ConcurrentHashMap<>();

    public CaptchaService(@Value("${captcha.secret}") String secret) {
        byte[] k;
        try {
            k = Base64.getDecoder().decode(secret);
        }
        catch (IllegalArgumentException e) {
            throw new IllegalStateException("captcha.secret must be Base64-encoded");
        }
        if (k.length != 16 && k.length != 24 && k.length != 32) {
            throw new IllegalStateException("captcha.secret must decode to 16, 24 or 32 bytes");
        }
        this.key = new SecretKeySpec(k, "AES");
        log.info("initialization, key length {} bytes", k.length);
    }

    public Captcha issue() {
        String code = randomCode();
        long expiry = System.currentTimeMillis() + CaptchaConstants.TTL_MS;
        log.info("new captcha issued");
        return new Captcha(encrypt(code + ":" + expiry), render(code));
    }

    public void verify(CaptchaProof proof) {
        if (proof == null || proof.id() == null || proof.answer() == null) {
            log.info("captcha rejected: null fields");
            throw new ApiException(ErrorCode.CAPTCHA_REQUIRED);
        }

        String plain;
        try {
            plain = decrypt(proof.id());
        }
        catch (Exception e) {
            log.info("captcha rejected: bad token");
            throw new ApiException(ErrorCode.CAPTCHA_INVALID);
        }

        int sep = plain.lastIndexOf(':');
        if (sep < 0) {
            log.info("captcha rejected: bad payload");
            throw new ApiException(ErrorCode.CAPTCHA_INVALID);
        }
        String code = plain.substring(0, sep);
        long expiry;
        try {
            expiry = Long.parseLong(plain.substring(sep + 1));
        }
        catch (NumberFormatException e) {
            log.info("captcha rejected: bad payload");
            throw new ApiException(ErrorCode.CAPTCHA_INVALID);
        }

        if (System.currentTimeMillis() > expiry) {
            log.info("captcha rejected: expired");
            throw new ApiException(ErrorCode.CAPTCHA_EXPIRED);
        }
        if (consumed.putIfAbsent(proof.id(), expiry) != null) {
            log.info("captcha rejected: already used");
            throw new ApiException(ErrorCode.CAPTCHA_INVALID);
        }
        if (!code.equalsIgnoreCase(proof.answer().trim())) {
            log.info("captcha rejected: incorrect");
            throw new ApiException(ErrorCode.CAPTCHA_INCORRECT);
        }
    }

    @Scheduled(fixedDelay = 60L * 1000)
    void cleanExpired() {
        long now = System.currentTimeMillis();
        consumed.values().removeIf(expiry -> now > expiry);
    }

    private String encrypt(String plain) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[IV_LENGTH + ct.length];
            System.arraycopy(iv, 0, out, 0, IV_LENGTH);
            System.arraycopy(ct, 0, out, IV_LENGTH, ct.length);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        }
        catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String decrypt(String token) throws Exception {
        byte[] in = Base64.getUrlDecoder().decode(token);
        if (in.length <= IV_LENGTH) {
            throw new IllegalArgumentException("token too short");
        }
        byte[] iv = new byte[IV_LENGTH];
        System.arraycopy(in, 0, iv, 0, IV_LENGTH);
        byte[] ct = new byte[in.length - IV_LENGTH];
        System.arraycopy(in, IV_LENGTH, ct, 0, ct.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(CaptchaConstants.CODE_LENGTH);
        for (int i = 0; i < CaptchaConstants.CODE_LENGTH; i++) {
            sb.append(CaptchaConstants.ALPHABET.charAt(random.nextInt(CaptchaConstants.ALPHABET.length())));
        }
        return sb.toString();
    }

    private String render(String code) {
        int w = CaptchaConstants.WIDTH;
        int h = CaptchaConstants.HEIGHT;
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        g.setColor(new Color(18, 22, 32));
        g.fillRect(0, 0, w, h);

        for (int i = 0; i < 220; i++) {
            g.setColor(new Color(40 + random.nextInt(80), 40 + random.nextInt(80), 50 + random.nextInt(90)));
            g.fillRect(random.nextInt(w), random.nextInt(h), 2, 2);
        }
        for (int i = 0; i < 6; i++) {
            g.setColor(new Color(60 + random.nextInt(120), 60 + random.nextInt(120), 70 + random.nextInt(140)));
            g.setStroke(new BasicStroke(1f + random.nextFloat() * 2f));
            g.drawLine(random.nextInt(w), random.nextInt(h), random.nextInt(w), random.nextInt(h));
        }

        String[] fonts = {Font.SANS_SERIF, Font.SERIF, Font.MONOSPACED};
        int cell = w / (code.length() + 1);
        for (int i = 0; i < code.length(); i++) {
            int style = random.nextBoolean() ? Font.BOLD : Font.PLAIN;
            int size = 34 + random.nextInt(12);
            g.setFont(new Font(fonts[random.nextInt(fonts.length)], style, size));
            g.setColor(new Color(170 + random.nextInt(85), 170 + random.nextInt(85), 190 + random.nextInt(65)));

            int x = cell * (i + 1) - cell / 3;
            int y = h / 2 + size / 3;
            AffineTransform saved = g.getTransform();
            g.rotate((random.nextDouble() - 0.5) * 0.7, x, y);
            g.drawString(String.valueOf(code.charAt(i)), x, y);
            g.setTransform(saved);
        }
        g.dispose();

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", baos);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(baos.toByteArray());
        }
        catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
