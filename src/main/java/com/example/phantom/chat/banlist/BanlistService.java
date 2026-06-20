package com.example.phantom.chat.banlist;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

@Service
public class BanlistService {

    private final UserRepository userRepository;
    private final BanRepository banRepository;
    private final NotificationPublishService notificationPublishService;

    public BanlistService(UserRepository userRepository, BanRepository banRepository, NotificationPublishService notificationPublishService) {
        this.userRepository = userRepository;
        this.banRepository = banRepository;
        this.notificationPublishService = notificationPublishService;
    }

    public BanRepresentation getById(Long userId) {
        Ban ban = banRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_BANNED));
        if (!ban.isActive()) {
            throw new ApiException(ErrorCode.NOT_BANNED);
        }
        return new BanRepresentation(ban);
    }

    public void validateChatPermission(Long userId) {
        Ban ban = banRepository.findById(userId).orElse(null);
        if (ban != null && ban.isActive()) {
            throw new ApiException(ErrorCode.BANNED);
        }
    }

    @Transactional
    public Map<String, String> ban(Long userId, Long targetId, BanRequest request) {
        User user = getChatModerator(userId);

        String reason = request.getReason();
        Long duration = request.getDuration();

        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        if (Objects.equals(userId, target.getId())) {
            throw new ApiException(ErrorCode.CANT_BAN_SELF);
        }

        if (target.getRole().getChatModeratorAccess()) {
            throw new ApiException(ErrorCode.CANT_BAN_MODERATOR);
        }

        Ban ban = banRepository.findById(target.getId()).orElse(null);
        if (ban != null && ban.isActive()) {
            throw new ApiException(ErrorCode.ALREADY_BANNED);
        }

        Long now = Instant.now().getEpochSecond();

        if (ban == null) {
            ban = new Ban();
        }
        ban.setUser(target);
        ban.setTimestamp(now);
        ban.setModerator(user);
        ban.setDuration(duration);
        ban.setReason(reason);
        banRepository.save(ban);

        notificationPublishService.createUserNotification(target, NotificationType.BANNED, new BanRepresentation(ban));

        return Map.of("message", "banned");
    }

    @Transactional
    public void unban(Long userId, Long targetId) {
        User user = getChatModerator(userId);

        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        Ban ban = banRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.NOT_BANNED));
        if (!ban.isActive()) {
            throw new ApiException(ErrorCode.NOT_BANNED);
        }

        notificationPublishService.createUserNotification(target, NotificationType.UNBANNED, null);

        banRepository.delete(ban);
    }

    private User getChatModerator(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        if (!user.getRole().getChatModeratorAccess()) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return user;
    }
}
