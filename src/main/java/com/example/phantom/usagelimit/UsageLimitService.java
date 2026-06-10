package com.example.phantom.usagelimit;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
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

    public void startAction(User user, UsageAction action, long tokens) {
        usageLimiter.startAction(user, action, tokens);
    }

    public UsageLimitRepresentation get(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        return usageLimiter.get(user);
    }
}
