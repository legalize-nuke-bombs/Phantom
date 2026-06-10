package com.example.phantom.owner;

import com.example.phantom.crypto.withdrawal.Withdrawal;
import com.example.phantom.crypto.withdrawal.WithdrawalRepository;
import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class OwnerService {

    private final UserRepository userRepository;
    private final WithdrawalRepository withdrawalRepository;

    private final OwnerAccessValidator ownerAccessValidator;
    private final UsageLimitService usageLimitService;
    private final ProfileService profileService;

    public OwnerService(UserRepository userRepository, WithdrawalRepository withdrawalRepository, OwnerAccessValidator ownerAccessValidator, UsageLimitService usageLimitService, ProfileService profileService) {
        this.userRepository = userRepository;
        this.withdrawalRepository = withdrawalRepository;

        this.ownerAccessValidator = ownerAccessValidator;
        this.usageLimitService = usageLimitService;
        this.profileService = profileService;
    }

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

        boolean isOwner = ownerAccessValidator.isOwner(ownerKey);

        if ((target.getRole() == Role.OWNER || role == Role.OWNER) && !isOwner) {
            throw new ApiException(ErrorCode.OWNER_KEY_REQUIRED);
        }

        target.setRole(role);
        userRepository.save(target);

        return Map.of("message", "changed");
    }

    public List<WithdrawalRepresentation> getWithdrawalHistory(Long userId, Integer limit, Long before) {
        User user = getOwner(userId);

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Withdrawal> withdrawals = withdrawalRepository.findHistoryWithUsers(before, pageable);

        List<User> users = withdrawals.stream().map(Withdrawal::getUser).toList();
        Map<Long, ProfileCardRepresentation> profileCardMap = profileService.getCardsForUsers(userId, users);

        return withdrawals.stream().map(withdrawal -> new WithdrawalRepresentation(withdrawal, profileCardMap.get(withdrawal.getUser().getId()))).toList();
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        if (user.getRole() != Role.OWNER) {
            throw new ApiException(ErrorCode.NOT_OWNER);
        }
        return user;
    }
}
