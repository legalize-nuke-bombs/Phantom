package com.example.phantom.owner;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.UnauthorizedException;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.Objects;

@Service
public class OwnerService {

    private final UserRepository userRepository;

    private final OwnerAccessValidator ownerAccessValidator;

    public OwnerService(UserRepository userRepository, OwnerAccessValidator ownerAccessValidator) {
        this.userRepository = userRepository;

        this.ownerAccessValidator = ownerAccessValidator;
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

        if ((target.getRole() == Role.OWNER || role == Role.OWNER) && !ownerAccessValidator.isOwner(ownerKey)) {
            throw new UnauthorizedException("owner key not specified");
        }

        target.setRole(role);
        userRepository.save(target);

        return Map.of("message", "changed");
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        if (user.getRole() != Role.OWNER) {
            throw new ForbiddenException("not an owner");
        }
        return user;
    }
}
