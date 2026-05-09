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
        Long now = Instant.now().getEpochSecond();

        String rulesKey = rulesKey(action, user.getPlan());
        String statesKey = statesKey(action, user.getId());

        Rule rule = rules.get(rulesKey);
        if (rule == null) throw new RuntimeException("rule not found");

        State state = states.get(statesKey);
        if (state == null || (now - state.getTimestamp() > rule.getSeconds())) {
            state = new State(now, 0L);
        }

        state.setTokens(state.getTokens() + tokens);

        if (state.getTokens() > rule.getTokens()) {
            throw new RateLimitReached(
                    "too many requests for '" + action + "', "
                            + "try again in " + (state.getTimestamp() + rule.getSeconds() - now) + " seconds");
        }

        states.put(statesKey, state);
    }

    private String rulesKey(String action, Plan plan) {
        return action + "." + plan.name();
    }

    private String statesKey(String action, Long userId) {
        return action + "." + userId;
    }
}
