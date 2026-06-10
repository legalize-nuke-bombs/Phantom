package com.example.phantom.usagelimit;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.user.Plan;
import com.example.phantom.user.User;
import java.time.Instant;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

class UsageLimiter {
    private final Map<Plan, Map<UsageAction, UsageLimitRule>> rules;
    private final Map<Long, Map<UsageAction, UsageLimitState>> states;

    public UsageLimiter() {
        this.rules = new ConcurrentHashMap<>();
        this.states = new ConcurrentHashMap<>();
    }

    public void registerRules(UsageAction action, Map<Plan, UsageLimitRule> rules) {
        if (rules.size() != Plan.values().length) {
            throw new RuntimeException("bad rules");
        }

        rules.forEach((plan, rule) -> {
            this.rules.putIfAbsent(plan, new ConcurrentHashMap<>());
            this.rules.get(plan).put(action, rule);
        });
    }

    public void startAction(User user, UsageAction action, long tokens) {
        long now = Instant.now().getEpochSecond();

        Map<UsageAction, UsageLimitRule> planRules = rules.get(user.getPlan());

        UsageLimitRule rule = planRules != null ? planRules.get(action) : null;
        if (rule == null) {
            throw new RuntimeException("rule not found");
        }

        states.compute(user.getId(), (key1, userStates) -> {
            if (userStates == null) {
                userStates = new ConcurrentHashMap<>();
            }

            userStates.compute(action, (key2, state) -> {
                if (state == null || (now - state.getTimestamp() > rule.getSeconds())) {
                    state = new UsageLimitState(now, 0L);
                }
                if (state.getTokens() + tokens > rule.getTokens()) {
                    long retryIn = state.getTimestamp() + rule.getSeconds() - now;
                    throw new ApiException(ErrorCode.RATE_LIMITED, "try again in " + retryIn + " seconds");
                }
                state.setTokens(state.getTokens() + tokens);
                return state;
            });

            return userStates;
        });
    }

    public UsageLimitRepresentation get(User user) {
        UsageLimitRepresentation representation = new UsageLimitRepresentation();
        representation.setData(new TreeMap<>());

        long now = Instant.now().getEpochSecond();

        Map<UsageAction, UsageLimitRule> planRules = rules.get(user.getPlan());
        Map<UsageAction, UsageLimitState> userStates = states.get(user.getId());

        planRules.forEach((action, rule) -> {
            UsageLimitState state = userStates != null ? userStates.get(action) : null;

            UsageLimitActionRepresentation actionRepresentation = new UsageLimitActionRepresentation();
            actionRepresentation.setSeconds(rule.getSeconds());
            actionRepresentation.setTokensTotal(rule.getTokens());
            if (state != null && (now - state.getTimestamp() <= rule.getSeconds())) {
                actionRepresentation.setTimestamp(state.getTimestamp());
                actionRepresentation.setTokensSpent(state.getTokens());
            }
            representation.getData().put(action.name(), actionRepresentation);
        });

        return representation;
    }
}
