package com.example.phantom.disk;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class DiskUploadRateLimitFilter extends OncePerRequestFilter {

    private static final String DISK_UPLOAD_PATH = "/api/disk/files";

    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;

    public DiskUploadRateLimitFilter(RateLimitService rateLimitService, ObjectMapper objectMapper) {
        this.rateLimitService = rateLimitService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if ("POST".equalsIgnoreCase(request.getMethod()) && DISK_UPLOAD_PATH.equals(request.getRequestURI())) {
            long contentLength = request.getContentLengthLong();
            if (contentLength < 0) {
                writeProblem(response, new ApiException(ErrorCode.LENGTH_REQUIRED));
                return;
            }
            Long userId = currentUserId();
            if (userId != null) {
                try {
                    rateLimitService.startAction(userId, RateLimitAction.UPLOAD, contentLength);
                }
                catch (ApiException e) {
                    writeProblem(response, e);
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.getPrincipal() instanceof Long userId) ? userId : null;
    }

    private void writeProblem(HttpServletResponse response, ApiException e) throws IOException {
        HttpStatus status = e.getCode().getStatus();
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setProperty("code", e.getCode().name());
        if (e.getMessage() != null) {
            problem.setDetail(e.getMessage());
        }
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
