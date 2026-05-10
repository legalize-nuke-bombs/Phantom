package com.example.phantom.ratelimit;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class RateLimitService {

    private final UserRepository userRepository;
    private final RateLimiter rateLimiter;

    public RateLimitService(UserRepository userRepository, RateLimiter rateLimiter) {
        this.userRepository = userRepository;
        this.rateLimiter = rateLimiter;
    }

    public RateLimitRepresentation get(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        return rateLimiter.get(user);
    }
}
