package com.example.phantom.disk.image;

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

    private static final int MAX_DIMENSION = 1280;
    private static final long MAX_SOURCE_PIXELS = 50L * 1_000_000;
    private static final double JPEG_QUALITY = 0.8;

    public byte[] compress(InputStream input) {
        byte[] result = null;

        try {
            byte[] source = input.readAllBytes();

            int[] dimensions = readDimensions(source);
            if (dimensions == null || (long) dimensions[0] * dimensions[1] > MAX_SOURCE_PIXELS) {
                return null;
            }

            int longest = Math.max(dimensions[0], dimensions[1]);
            double scale = longest > MAX_DIMENSION ? (double) MAX_DIMENSION / longest : 1.0;

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Thumbnails.of(new ByteArrayInputStream(source))
                    .scale(scale)
                    .outputFormat("jpg")
                    .outputQuality(JPEG_QUALITY)
                    .toOutputStream(out);
            result = out.toByteArray();
        }
        catch (Exception e) {
            log.warn("compression failed", e);
        }

        return result;
    }

    private int[] readDimensions(byte[] source) throws IOException {
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
                return new int[]{reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        }
    }
}
