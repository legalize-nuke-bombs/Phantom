package com.example.phantom.usagelimit;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UsageLimitService {

    private final UserRepository userRepository;
    private final UsageLimiter usageLimiter;

    public UsageLimitService(UserRepository userRepository, UsageLimiter usageLimiter) {
        this.userRepository = userRepository;
        this.usageLimiter = usageLimiter;
    }

    public UsageLimitRepresentation get(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        return usageLimiter.get(user);
    }
}
