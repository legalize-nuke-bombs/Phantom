package com.example.phantom.ratelimit;

import com.example.phantom.user.Plan;
import com.example.phantom.user.User;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class RateLimiter {
    private final Map<String, Rule> rules;
    private final Map<String, State> states;

    public RateLimiter() {
        this.rules = new ConcurrentHashMap<>();
        this.states = new ConcurrentHashMap<>();
    }

    public void registerRules(String action, Map<Plan, Rule> rules) {
        if (rules.size() != Plan.values().length) {
            throw new RuntimeException("bad rules");
        }

        rules.forEach((plan, rule) -> {
            this.rules.put(rulesKey(action, plan), rule);
        }
        );
    }

    public void startAction(User user, String action, Long tokens) throws RateLimitReached {
        long now = Instant.now().getEpochSecond();

        Rule rule = rules.get(rulesKey(action, user.getPlan()));
        if (rule == null) throw new RuntimeException("rule not found");

        String statesKey = statesKey(action, user.getId());

        try {
            states.compute(statesKey, (key, state) -> {
                if (state == null || (now - state.getTimestamp() > rule.getSeconds())) {
                    state = new State(now, 0L);
                }
                if (state.getTokens() + tokens > rule.getTokens()) {
                    throw new RateLimitReachedRuntime(action, state.getTimestamp() + rule.getSeconds() - now);
                }
                state.setTokens(state.getTokens() + tokens);
                return state;
            });
        }
        catch (RateLimitReachedRuntime e) {
            throw new RateLimitReached(e.getMessage());
        }
    }

    private String rulesKey(String action, Plan plan) {
        return action + "." + plan.name();
    }

    private String statesKey(String action, Long userId) {
        return action + "." + userId;
    }
}
