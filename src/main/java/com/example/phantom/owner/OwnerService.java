package com.example.phantom.owner;

import com.example.phantom.crypto.withdrawal.Withdrawal;
import com.example.phantom.crypto.withdrawal.WithdrawalRepository;
import com.example.phantom.crypto.withdrawal.WithdrawalRepresentation;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.experience.Experience;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
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
    private final UsageLimiter usageLimiter;
    private final ProfileService profileService;

    public OwnerService(UserRepository userRepository, WithdrawalRepository withdrawalRepository, OwnerAccessValidator ownerAccessValidator, UsageLimiter usageLimiter, ProfileService profileService) {
        this.userRepository = userRepository;
        this.withdrawalRepository = withdrawalRepository;

        this.ownerAccessValidator = ownerAccessValidator;
        this.usageLimiter = usageLimiter;
        this.profileService = profileService;
    }

    public Map<String, String> changeUserRole(Long userId, ChangeUserRoleRequest request) {
        getOwner(userId);

        Long targetId = request.getTargetId();

        if (Objects.equals(userId, targetId)) {
            throw new BadRequestException("can't change your own role");
        }

        User target = userRepository.findById(targetId).orElseThrow(() -> new NotFoundException("target user not found"));
        Role role = request.getRole();
        String ownerKey = request.getOwnerKey();

        if (target.getRole() == role) {
            throw new BadRequestException("target already has this role");
        }

        boolean isOwner;
        try { isOwner = ownerAccessValidator.isOwner(ownerKey); }
        catch (OwnerBadAccess e) { throw new BadRequestException(e.getMessage()); }
        catch (OwnerAccessDenied e) { throw new ForbiddenException(e.getMessage()); }

        if ((target.getRole() == Role.OWNER || role == Role.OWNER) && !isOwner) {
            throw new ForbiddenException("owner key not specified");
        }

        target.setRole(role);
        userRepository.save(target);

        return Map.of("message", "changed");
    }

    public List<WithdrawalRepresentation> getWithdrawalHistory(Long userId, Integer limit, Long before) {
        User user = getOwner(userId);

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, limit.longValue()); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<Withdrawal> withdrawals = before != null
                ? withdrawalRepository.findHistoryWithUsersBefore(before, pageable)
                : withdrawalRepository.findHistoryWithUsers(pageable);

        List<User> users = withdrawals.stream().map(Withdrawal::getUser).toList();
        Map<Long, ProfileCardRepresentation> profileCardMap = profileService.getCardsForUsers(userId, users);

        return withdrawals.stream().map(withdrawal -> new WithdrawalRepresentation(withdrawal, profileCardMap.get(withdrawal.getUser().getId()))).toList();
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        if (user.getRole() != Role.OWNER) {
            throw new ForbiddenException("not an owner");
        }
        return user;
    }
}
