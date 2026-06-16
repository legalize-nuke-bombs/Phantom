package com.example.phantom.owner;

import com.example.phantom.crypto.withdrawal.Withdrawal;
import com.example.phantom.crypto.withdrawal.WithdrawalRepository;
import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class OwnerService {

    private final UserRepository userRepository;
    private final WithdrawalRepository withdrawalRepository;

    private final OwnerAccessService ownerAccessService;
    private final RateLimitService rateLimitService;
    private final ProfileService profileService;
    private final NotificationPublishService notificationPublishService;

    public OwnerService(UserRepository userRepository, WithdrawalRepository withdrawalRepository, OwnerAccessService ownerAccessService, RateLimitService rateLimitService, ProfileService profileService, NotificationPublishService notificationPublishService) {
        this.userRepository = userRepository;
        this.withdrawalRepository = withdrawalRepository;

        this.ownerAccessService = ownerAccessService;
        this.rateLimitService = rateLimitService;
        this.profileService = profileService;
        this.notificationPublishService = notificationPublishService;
    }

    @Transactional
    public Map<String, String> changeUserRole(Long userId, ChangeUserRoleRequest request) {
        getOwner(userId);

        Long targetId = request.getTargetId();

        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_CHANGE_OWN_ROLE);
        }

        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        Role role = request.getRole();
        String ownerKey = request.getOwnerKey();

        if (target.getRole() == role) {
            throw new ApiException(ErrorCode.ROLE_UNCHANGED);
        }

        boolean isOwner = ownerAccessService.isOwner(ownerKey);

        if ((target.getRole().getOwnerAccess() || role.getOwnerAccess()) && !isOwner) {
            throw new ApiException(ErrorCode.OWNER_KEY_REQUIRED);
        }

        target.setRole(role);
        target = userRepository.save(target);

        notificationPublishService.createUserNotification(target, NotificationType.ROLE_CLAIMED, null);

        return Map.of("message", "changed");
    }

    public List<WithdrawalRepresentation> getWithdrawalHistory(Long userId, Integer limit, Long before) {
        User user = getOwner(userId);

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Withdrawal> withdrawals = withdrawalRepository.findHistoryWithUsers(before, pageable);

        List<User> users = withdrawals.stream().map(Withdrawal::getUser).toList();
        Map<Long, ProfileCardRepresentation> profileCardMap = profileService.getCardsForUsers(userId, users);

        return withdrawals.stream().map(withdrawal -> new WithdrawalRepresentation(withdrawal, profileCardMap.get(withdrawal.getUser().getId()))).toList();
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        if (!user.getRole().getOwnerAccess()) {
            throw new ApiException(ErrorCode.NOT_OWNER);
        }
        return user;
    }
}
