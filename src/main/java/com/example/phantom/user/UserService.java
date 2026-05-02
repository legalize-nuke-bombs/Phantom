package com.example.phantom.user;

import com.example.phantom.exception.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserRepresentation getUserRepresentationById(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        return buildUserRepresentation(user);
    }

    public UserRepresentation getUserRepresentationByUsername(String username) {
        User user = userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("user not found"));
        return buildUserRepresentation(user);
    }

    @Transactional
    public Map<String, String> patchMe(Long userId, PatchMeRequest request) {
        String displayName = request.getDisplayName();

        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (displayName != null) user.setDisplayName(displayName);

        userRepository.save(user);

        return Map.of("message", "patched");
    }

    @Transactional
    public Map<String, String> patchMeSecure(Long userId, PatchMeSecureRequest request) {
        String currentPassword = request.getCurrentPassword();
        String username = request.getUsername();
        String password = request.getPassword();

        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("invalid password");
        }

        if (username != null) user.setUsername(username);
        if (password != null) user.setPasswordHash(passwordEncoder.encode(password));

        try {
            userRepository.save(user);
        }
        catch (DataIntegrityViolationException e) {
            throw new ConflictException("username already exists");
        }

        return Map.of("message", "patched");
    }

    @Transactional
    public void deleteMe(Long userId, DeleteMeRequest request) {
        String password = request.getPassword();

        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new UnauthorizedException("invalid password");
        }

        userRepository.delete(user);
    }

    private UserRepresentation buildUserRepresentation(User user) {
        UserRepresentation representation = new UserRepresentation();
        representation.setId(user.getId());
        representation.setUsername(user.getUsername());
        representation.setDisplayName(user.getDisplayName());
        return representation;
    }
}
