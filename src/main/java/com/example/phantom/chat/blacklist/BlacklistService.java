package com.example.phantom.chat.blacklist;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

@Service
@Slf4j
public class BlacklistService {

    private final UserRepository userRepository;
    private final BlacklistRepository blacklistRepository;
    private final BlacklistMemberRepository blacklistMemberRepository;
    private final RateLimitService rateLimitService;

    public BlacklistService(UserRepository userRepository, BlacklistRepository blacklistRepository, BlacklistMemberRepository blacklistMemberRepository, RateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.blacklistRepository = blacklistRepository;
        this.blacklistMemberRepository = blacklistMemberRepository;
        this.rateLimitService = rateLimitService;
    }

    public BlacklistRepresentation get(Long userId, Integer limit, Long before) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        return new BlacklistRepresentation(
                blacklistMemberRepository.findUsersById(userId, before, pageable).stream().map(UserShortRepresentation::new).toList()
        );
    }

    public void validateMessage(Long userId, Long targetId) {
        if (blacklistMemberRepository.findByBlacklistIdUserId(userId, targetId).isPresent()) {
            throw new ApiException(ErrorCode.BLOCKED);
        }
    }

    @Transactional
    public Void post(Long userId, Long targetId) {
        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_BLOCK_SELF);
        }

        Blacklist blacklist = blacklistRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.INTERNAL_ERROR, "blacklist not found"));
        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        try {
            BlacklistMember blacklistMember = new BlacklistMember();
            blacklistMember.setBlacklist(blacklist);
            blacklistMember.setUser(target);
            blacklistMemberRepository.save(blacklistMember);
        }
        catch (DataIntegrityViolationException e) {
            log.info("user {} tried to post duplicate to blacklist", userId);
            throw new ApiException(ErrorCode.ALREADY_BLOCKED);
        }

        log.info("user {} posted to blacklist", userId);
        return null;
    }

    @Transactional
    public void delete(Long userId, Long targetId) {
        log.info("user {} requested deletion from blacklist", userId);
        blacklistMemberRepository.deleteByBlacklistIdUserId(userId, targetId);
    }
}
