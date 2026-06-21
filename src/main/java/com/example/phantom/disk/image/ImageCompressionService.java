package com.example.phantom.disk.image;

import com.example.phantom.exception.ApiException;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import lombok.extern.slf4j.Slf4j;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;

@Service
@Slf4j
public class ImageCompressionService {

    private final RateLimitService rateLimitService;

    public ImageCompressionService(RateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    private static final int MAX_DIMENSION = 1280;
    private static final long MAX_SOURCE_PIXELS = 50L * 1_000_000;
    private static final double JPEG_QUALITY = 0.8;

    public Result compress(InputStream input, Long userId) {
        try {
            byte[] source = input.readAllBytes();

            Info info = readInfo(source);
            if (info == null) {
                log.info("compression for {} skipped: info is null", userId);
                return null;
            }
            if ((long)info.width() * info.height() > MAX_SOURCE_PIXELS) {
                log.info("compression for {} skipped: image is too large {} x {}", userId, info.width(), info.height());
                return null;
            }

            rateLimitService.startAction(userId, RateLimitAction.IMAGE_COMPRESS, (long)info.width() * info.height());

            log.info("compressing for {}, image {} x {} ...", userId, info.width(), info.height());

            String raw = info.format() == null ? "" : info.format().toLowerCase();
            String format = raw.equals("jpeg") ? "jpg" : raw;
            if (!format.equals("jpg") && !format.equals("png")) {
                return null;
            }

            int longest = Math.max(info.width(), info.height());
            double scale = longest > MAX_DIMENSION ? (double) MAX_DIMENSION / longest : 1.0;

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (format.equals("jpg")) {
                Thumbnails.of(new ByteArrayInputStream(source))
                        .scale(scale)
                        .outputFormat("jpg")
                        .outputQuality(JPEG_QUALITY)
                        .toOutputStream(out);
            }
            else {
                Thumbnails.of(new ByteArrayInputStream(source))
                        .scale(scale)
                        .outputFormat("png")
                        .toOutputStream(out);
            }

            byte[] result = out.toByteArray();
            if (result.length >= source.length) {
                return null;
            }
            return new Result(result, format);
        }
        catch (ApiException e) {
            return null;
        }
        catch (Exception e) {
            log.warn("compression failed", e);
            return null;
        }
    }

    private Info readInfo(byte[] source) throws IOException {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
            if (iis == null) {
                return null;
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis);
                return new Info(reader.getWidth(0), reader.getHeight(0), reader.getFormatName());
            } finally {
                reader.dispose();
            }
        }
    }

    public record Result(byte[] bytes, String extension) {}

    private record Info(int width, int height, String format) {}
}
