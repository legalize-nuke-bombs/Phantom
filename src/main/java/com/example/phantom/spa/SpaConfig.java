package com.example.phantom.spa;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

@Configuration
public class SpaConfig implements WebMvcConfigurer {

    private final String staticLocation;

    public SpaConfig(@Value("${spring.web.resources.static-locations}") String staticLocation) {
        this.staticLocation = staticLocation.endsWith("/") ? staticLocation : staticLocation + "/";
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations(staticLocation)
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        if (resourcePath.startsWith("api/") || resourcePath.startsWith("ws") || resourcePath.startsWith("v3/")) {
                            return null;
                        }
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        String last = resourcePath.substring(resourcePath.lastIndexOf('/') + 1);
                        if (last.contains(".")) {
                            return null;
                        }
                        return location.createRelative("index.html");
                    }
                });
    }
}
