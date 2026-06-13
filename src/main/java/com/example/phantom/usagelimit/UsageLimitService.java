package com.example.phantom.usagelimit;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.user.Plan;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UsageLimitService {

    private final UserRepository userRepository;
    private final UsageLimiter usageLimiter;

    public UsageLimitService(UserRepository userRepository) {
        this.userRepository = userRepository;
        this.usageLimiter = new UsageLimiter();

        usageLimiter.registerRules(UsageAction.PAGINATION, Map.of(
                Plan.DEFAULT, new UsageLimitRule(20L * 100, 60L),
                Plan.PRO, new UsageLimitRule(20L * 200, 60L),
                Plan.MAX, new UsageLimitRule(20L * 400, 60L)
        ));

        usageLimiter.registerRules(UsageAction.CRYPTO, Map.of(
                Plan.DEFAULT, new UsageLimitRule(10L, 60L),
                Plan.PRO, new UsageLimitRule(20L, 60L),
                Plan.MAX, new UsageLimitRule(40L, 60L)
        ));

        usageLimiter.registerRules(UsageAction.LOTTERY, Map.of(
                Plan.DEFAULT, new UsageLimitRule(10L, 60L),
                Plan.PRO, new UsageLimitRule(10L, 60L),
                Plan.MAX, new UsageLimitRule(10L, 60L)
        ));

        usageLimiter.registerRules(UsageAction.SEND_MESSAGE, Map.of(
                Plan.DEFAULT, new UsageLimitRule(100L, 10 * 60L),
                Plan.PRO, new UsageLimitRule(1000L, 10 * 60L),
                Plan.MAX, new UsageLimitRule(10000L, 10 * 60L)
        ));

        usageLimiter.registerRules(UsageAction.SEND_PRESENT, Map.of(
                Plan.DEFAULT, new UsageLimitRule(10L, 10 * 60L),
                Plan.PRO, new UsageLimitRule(1000L, 10 * 60L),
                Plan.MAX, new UsageLimitRule(10000L, 10 * 60L)
        ));
    }

    public void startAction(User user, UsageAction action, long tokens) {
        usageLimiter.startAction(user, action, tokens);
    }

    public UsageLimitRepresentation get(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        return usageLimiter.get(user);
    }
}
