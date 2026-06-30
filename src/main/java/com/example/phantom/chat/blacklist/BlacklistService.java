package com.example.phantom.chat.blacklist;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
@Slf4j
public class BlacklistService {

    private final UserRepository userRepository;
    private final BlackRepository blackRepository;
    private final NotificationPublishService notificationPublishService;
    private final RateLimitService rateLimitService;

    public BlacklistService(UserRepository userRepository, BlackRepository blackRepository, NotificationPublishService notificationPublishService, RateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.blackRepository = blackRepository;
        this.notificationPublishService = notificationPublishService;
        this.rateLimitService = rateLimitService;
    }

    @Transactional
    public BlackRepresentation post(Long userId, Long targetId) {
        rateLimitService.startAction(userId, RateLimitAction.BLACKLIST, 1);

        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_BLOCK_SELF);
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        log.info("user {} is posting to the blacklist", user.getId());

        Black black;
        try {
            black = new Black();
            black.setTimestamp(Instant.now().getEpochSecond());
            black.setAuthor(user);
            black.setTarget(target);
            black = blackRepository.save(black);
        }
        catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.ALREADY_BLOCKED);
        }

        notificationPublishService.createUserNotification(target, NotificationType.YOU_HAVE_BEEN_BLOCKED, new BlackRepresentation(black));
        return new BlackRepresentation(black);
    }

    @Transactional
    public void delete(Long userId, Long targetId) {
        rateLimitService.startAction(userId, RateLimitAction.BLACKLIST, 1);

        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        log.info("user {} is deleting from the blacklist", userId);
        Black black = blackRepository.findByAuthor_IdAndTarget_Id(userId, targetId).orElse(null);
        if (black == null) {
            return;
        }
        notificationPublishService.createUserNotification(target, NotificationType.YOU_HAVE_BEEN_UNBLOCKED, new BlackRepresentation(black));
        blackRepository.delete(black);
    }

    public BlackRepresentation amIBlocked(Long userId, Long targetId) {
        Black black = blackRepository.findByAuthor_IdAndTarget_Id(targetId, userId).orElse(null);
        return black != null ? new BlackRepresentation(black) : null;
    }

    public BlackRepresentation isBlocked(Long userId, Long targetId) {
        Black black = blackRepository.findByAuthor_IdAndTarget_Id(userId, targetId).orElse(null);
        return black != null ? new BlackRepresentation(black) : null;
    }

    public List<BlackRepresentation> get(Long userId, Long before, Integer limit) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);
        List<Black> blacks = blackRepository.findByAuthorId(userId, before, pageable);
        return blacks.stream().map(BlackRepresentation::new).toList();
    }

    public void validate(Long userId, Long targetId) {
        if (blackRepository.findByAuthor_IdAndTarget_Id(userId, targetId).isPresent()) {
            throw new ApiException(ErrorCode.YOU_BLOCKED_THIS_USER);
        }
        if (blackRepository.findByAuthor_IdAndTarget_Id(targetId, userId).isPresent()) {
            throw new ApiException(ErrorCode.YOU_HAVE_BEEN_BLOCKED);
        }
    }
}
