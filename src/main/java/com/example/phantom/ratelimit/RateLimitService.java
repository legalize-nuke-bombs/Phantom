package com.example.phantom.ratelimit;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.LevelFeature;
import com.example.phantom.experience.LevelFeatureService;
import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    public RateLimitService(LevelFeatureService levelFeatureService,

                            @Value("${rate.pagination.tokens}") @NotNull Long paginationTokens,
                            @Value("${rate.pagination.seconds}") @NotNull Long paginationSeconds,

                            @Value("${rate.crypto.tokens}") @NotNull Long cryptoTokens,
                            @Value("${rate.crypto.seconds}") @NotNull Long cryptoSeconds,

                            @Value("${rate.lottery.tokens}") @NotNull Long lotteryTokens,
                            @Value("${rate.lottery.seconds}") @NotNull Long lotterySeconds,

                            @Value("${rate.send-message.tokens}") @NotNull Long sendMessageTokens,
                            @Value("${rate.send-message.seconds}") @NotNull Long sendMessageSeconds,

                            @Value("${rate.create-chat.tokens}") @NotNull Long createChatTokens,
                            @Value("${rate.create-chat.seconds}") @NotNull Long createChatSeconds,

                            @Value("${rate.invite-to-chat.tokens}") @NotNull Long inviteToChatTokens,
                            @Value("${rate.invite-to-chat.seconds}") @NotNull Long inviteToChatSeconds,

                            @Value("${rate.send-present.tokens}") @NotNull Long sendPresentTokens,
                            @Value("${rate.send-present.seconds}") @NotNull Long sendPresentSeconds,

                            @Value("${rate.download.null.tokens}") @NotNull Long downloadNullTokens,
                            @Value("${rate.download.null.seconds}") @NotNull Long downloadNullSeconds,

                            @Value("${rate.upload.disk-base.tokens}") @NotNull Long uploadDiskBaseTokens,
                            @Value("${rate.upload.disk-base.seconds}") @NotNull Long uploadDiskBaseSeconds,
                            @Value("${rate.download.disk-base.tokens}") @NotNull Long downloadDiskBaseTokens,
                            @Value("${rate.download.disk-base.seconds}") @NotNull Long downloadDiskBaseSeconds,
                            @Value("${rate.image-compress.disk-base.tokens}") @NotNull Long imageCompressDiskBaseTokens,
                            @Value("${rate.image-compress.disk-base.seconds}") @NotNull Long imageCompressDiskBaseSeconds,

                            @Value("${rate.upload.disk-base.tokens}") @NotNull Long uploadDiskPlusTokens,
                            @Value("${rate.upload.disk-base.seconds}") @NotNull Long uploadDiskPlusSeconds,
                            @Value("${rate.download.disk-base.tokens}") @NotNull Long downloadDiskPlusTokens,
                            @Value("${rate.download.disk-base.seconds}") @NotNull Long downloadDiskPlusSeconds,
                            @Value("${rate.image-compress.disk-base.tokens}") @NotNull Long imageCompressDiskPlusTokens,
                            @Value("${rate.image-compress.disk-base.seconds}") @NotNull Long imageCompressDiskPlusSeconds

                            ) {
        log.info("initialization...");

        this.levelFeatureService = levelFeatureService;

        this.rules = new ConcurrentHashMap<>();
        this.states = new ConcurrentHashMap<>();

        this.registerRule(RateLimitAction.PAGINATION, null, new RateLimitRule(paginationTokens, paginationSeconds));
        this.registerRule(RateLimitAction.CRYPTO, null, new RateLimitRule(cryptoTokens, cryptoSeconds));
        this.registerRule(RateLimitAction.LOTTERY, null, new RateLimitRule(lotteryTokens, lotterySeconds));
        this.registerRule(RateLimitAction.SEND_MESSAGE, LevelFeature.SEND_MESSAGE, new RateLimitRule(sendMessageTokens, sendMessageSeconds));
        this.registerRule(RateLimitAction.CREATE_CHAT, LevelFeature.SEND_MESSAGE, new RateLimitRule(createChatTokens, createChatSeconds));
        this.registerRule(RateLimitAction.INVITE_TO_CHAT, LevelFeature.SEND_MESSAGE, new RateLimitRule(inviteToChatTokens, inviteToChatSeconds));
        this.registerRule(RateLimitAction.SEND_PRESENT, LevelFeature.SEND_PRESENT, new RateLimitRule(sendPresentTokens, sendPresentSeconds));

        this.registerRule(RateLimitAction.DOWNLOAD, null, new RateLimitRule(downloadNullTokens, downloadNullSeconds));

        this.registerRule(RateLimitAction.UPLOAD, LevelFeature.DISK_BASE, new RateLimitRule(uploadDiskBaseTokens, uploadDiskBaseSeconds));
        this.registerRule(RateLimitAction.DOWNLOAD, LevelFeature.DISK_BASE, new RateLimitRule(downloadDiskBaseTokens, downloadDiskBaseSeconds));
        this.registerRule(RateLimitAction.IMAGE_COMPRESS, LevelFeature.DISK_BASE, new RateLimitRule(imageCompressDiskBaseTokens, imageCompressDiskBaseSeconds));

        this.registerRule(RateLimitAction.UPLOAD, LevelFeature.DISK_PLUS, new RateLimitRule(uploadDiskPlusTokens, uploadDiskPlusSeconds));
        this.registerRule(RateLimitAction.DOWNLOAD, LevelFeature.DISK_PLUS, new RateLimitRule(downloadDiskPlusTokens, downloadDiskPlusSeconds));
        this.registerRule(RateLimitAction.IMAGE_COMPRESS, LevelFeature.DISK_PLUS, new RateLimitRule(imageCompressDiskPlusTokens, imageCompressDiskPlusSeconds));
    }

    public void registerRule(RateLimitAction action, LevelFeature requiredFeature, RateLimitRule rule) {
        log.info("registering rule action {} requiredFeature {} tokens {} seconds {}...", action, requiredFeature, rule.getTokens(), rule.getSeconds());
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
    public void clean() {
        log.info("rate limit cleaner started...");
        long now = Instant.now().getEpochSecond();
        states.values().forEach(userStates -> userStates.values().removeIf(state -> now - state.getTimestamp() > CLEAN_DELAY_SEC));
        states.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        log.info("rate limit cleaner finished");
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
