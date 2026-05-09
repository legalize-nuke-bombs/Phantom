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
            throw new RuntimeException("bad rule");
        }

        rules.forEach((plan, rule) -> {
            this.rules.put(rulesKey(action, plan), rule);
        }
        );
    }

    public void startAction(User user, String action, Long tokens) throws RateLimitReached {
        Long now = Instant.now().getEpochSecond();

        Rule rule = rules.get(rulesKey(action, user.getPlan()));
        if (rule == null) throw new RuntimeException("unknown action");

        State state = states.get(stateKey(action, user.getId()));
        if (state == null || (now - state.getTimestamp() > rule.getSeconds())) {
            state = new State(now, 0L);
        }

        state.setTokens(state.getTokens() + tokens);

        if (state.getTokens() > rule.getTokens()) {
            throw new RateLimitReached(
                    "too many requests for '" + action + "', "
                            + "try again in " + (state.getTimestamp() + rule.getSeconds() - now) + " seconds");
        }

        states.put(action, state);
    }

    private String rulesKey(String action, Plan plan) {
        return action + "." + plan.name();
    }

    private String stateKey(String action, Long userId) {
        return action + "." + userId;
    }
}
