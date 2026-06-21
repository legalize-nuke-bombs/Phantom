package com.example.phantom.ratelimit;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.LevelFeature;
import com.example.phantom.experience.LevelFeatureService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class RateLimitService {

    private final LevelFeatureService levelFeatureService;

    private final Map<RateLimitAction, Map<LevelFeature, RateLimitRule>> rules;
    private final Map<Long, Map<RateLimitAction, RateLimitState>> states;

    private final static long CLEAN_DELAY_SEC = 8L * 3600;

    public RateLimitService(LevelFeatureService levelFeatureService) {
        this.levelFeatureService = levelFeatureService;

        this.rules = new ConcurrentHashMap<>();
        this.states = new ConcurrentHashMap<>();

        this.registerRule(RateLimitAction.PAGINATION, null, new RateLimitRule(40L * 100, 60L));
        this.registerRule(RateLimitAction.CRYPTO, null, new RateLimitRule(20L, 60L));
        this.registerRule(RateLimitAction.LOTTERY, null, new RateLimitRule(20L, 60L));
        this.registerRule(RateLimitAction.SEND_MESSAGE, LevelFeature.SEND_MESSAGE, new RateLimitRule(100L, 10L * 60));
        this.registerRule(RateLimitAction.CREATE_CHAT, LevelFeature.SEND_MESSAGE, new RateLimitRule(25L, 8L * 3600));
        this.registerRule(RateLimitAction.INVITE_TO_CHAT, LevelFeature.SEND_MESSAGE, new RateLimitRule(100L, 8L * 3600));
        this.registerRule(RateLimitAction.SEND_PRESENT, LevelFeature.SEND_PRESENT, new RateLimitRule(100L, 10L * 60));

        this.registerRule(RateLimitAction.DOWNLOAD, null, new RateLimitRule(200L * 1024 * 1024, 8L * 3600));

        this.registerRule(RateLimitAction.UPLOAD, LevelFeature.DISK_BASE, new RateLimitRule(2L * 1024 * 1024 * 1024, 8L * 3600));
        this.registerRule(RateLimitAction.DOWNLOAD, LevelFeature.DISK_BASE, new RateLimitRule(4L * 1024 * 1024 * 1024, 8L * 3600));
        this.registerRule(RateLimitAction.IMAGE_COMPRESS, LevelFeature.DISK_BASE, new RateLimitRule(100L * 7000 * 7000, 8L * 3600));

        this.registerRule(RateLimitAction.UPLOAD, LevelFeature.DISK_PLUS, new RateLimitRule(20L * 1024 * 1024 * 1024, 8L * 3600));
        this.registerRule(RateLimitAction.DOWNLOAD, LevelFeature.DISK_PLUS, new RateLimitRule(40L * 1024 * 1024 * 1024, 8L * 3600));
        this.registerRule(RateLimitAction.IMAGE_COMPRESS, LevelFeature.DISK_PLUS, new RateLimitRule(1000L * 7000 * 7000, 8L * 3600));
    }

    public void registerRule(RateLimitAction action, LevelFeature requiredFeature, RateLimitRule rule) {
        if (rule.getSeconds() > CLEAN_DELAY_SEC) {
            throw new IllegalArgumentException("window is too big, max = " + CLEAN_DELAY_SEC);
        }
        this.rules.putIfAbsent(action, new HashMap<>());
        this.rules.get(action).put(requiredFeature, rule);
    }

    public void startAction(Long userId, RateLimitAction action, long tokens) {
        if (tokens < 0) {
            log.warn("startAction skipped: unexpected tokens value user {} action {} tokens {}", userId, action, tokens);
            return;
        }

        long now = Instant.now().getEpochSecond();

        Map<LevelFeature, RateLimitRule> actionRules = rules.get(action);
        if (actionRules == null) {
            log.warn("unknown action {}", action);
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }

        RateLimitRule rule = resolveRule(actionRules, levelFeatureService.getFeatures(userId));
        if (rule == null) {
            log.info("user {} does not have permission for {}", userId, action);
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }

        states.compute(userId, (key1, userStates) -> {
            if (userStates == null) {
                userStates = new ConcurrentHashMap<>();
            }

            userStates.compute(action, (key2, state) -> {
                if (state == null || (now - state.getTimestamp() > rule.getSeconds())) {
                    state = new RateLimitState(now, 0L);
                }
                if (state.getTokens() + tokens > rule.getTokens()) {
                    long retryIn = state.getTimestamp() + rule.getSeconds() - now;
                    log.info("user {} reached limit for {}", userId, action);
                    throw new ApiException(ErrorCode.RATE_LIMITED, "try again in " + retryIn + " seconds");
                }
                state.setTokens(state.getTokens() + tokens);
                return state;
            });

            return userStates;
        });
    }

    public RateLimitRepresentation get(Long userId) {
        long now = Instant.now().getEpochSecond();

        Set<LevelFeature> features = levelFeatureService.getFeatures(userId);
        Map<RateLimitAction, RateLimitState> userStates = states.get(userId);

        RateLimitRepresentation representation = new RateLimitRepresentation();
        representation.setData(new TreeMap<>());

        rules.forEach((action, actionRules) -> {
            RateLimitRule rule = resolveRule(actionRules, features);
            if (rule == null) {
                return;
            }

            RateLimitState state = userStates != null ? userStates.get(action) : null;

            RateLimitActionRepresentation actionRepresentation = new RateLimitActionRepresentation();
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

    @Scheduled(fixedDelay = CLEAN_DELAY_SEC * 1000)
    public void cleanExpired() {
        log.info("cleaning expired started...");
        long now = Instant.now().getEpochSecond();
        states.values().forEach(userStates -> userStates.values().removeIf(state -> now - state.getTimestamp() > CLEAN_DELAY_SEC));
        states.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        log.info("cleaning expired done");
    }

    private RateLimitRule resolveRule(Map<LevelFeature, RateLimitRule> actionRules, Set<LevelFeature> features) {
        RateLimitRule best = actionRules.get(null);

        for (Map.Entry<LevelFeature, RateLimitRule> entry : actionRules.entrySet()) {
            LevelFeature feature = entry.getKey();
            if (feature == null) {
                continue;
            }
            if (features.contains(feature) && (best == null || entry.getValue().getTokens() > best.getTokens())) {
                best = entry.getValue();
            }
        }

        return best;
    }
}
