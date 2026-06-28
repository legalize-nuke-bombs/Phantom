package com.example.phantom.captcha;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

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
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class CaptchaService {

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Entry> challenges = new ConcurrentHashMap<>();

    private record Entry(String code, long expiry) {
    }

    public Captcha issue() {
        String id = randomId();
        String code = randomCode();
        challenges.put(id, new Entry(code, System.currentTimeMillis() + CaptchaConstants.TTL_MS));
        Captcha captcha = new Captcha(id, render(code));
        log.info("new captcha issued: id {}", id);
        return captcha;
    }

    public void verify(CaptchaProof proof) {
        if (proof == null || proof.id() == null || proof.answer() == null) {
            log.info("captcha rejected: null fields");
            throw new ApiException(ErrorCode.CAPTCHA_REQUIRED);
        }
        Entry entry = challenges.remove(proof.id());
        if (entry == null
                || System.currentTimeMillis() > entry.expiry()
                || !entry.code().equalsIgnoreCase(proof.answer().trim())) {
            log.info("captcha rejected");
            throw new ApiException(ErrorCode.CAPTCHA_INVALID);
        }
    }

    @Scheduled(fixedDelay = 60L * 1000)
    void cleanExpired() {
        log.info("cleaning expired captcha (current size {})...", challenges.size());
        long now = System.currentTimeMillis();
        challenges.values().removeIf(e -> now > e.expiry());
    }

    private String randomId() {
        byte[] b = new byte[16];
        random.nextBytes(b);
        return HexFormat.of().formatHex(b);
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
