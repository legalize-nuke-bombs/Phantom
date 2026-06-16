package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ChatModeratorActionService {

    private final ChatModeratorActionRepository chatModeratorActionRepository;
    private final UserRepository userRepository;

    private final RateLimitService rateLimitService;

    public ChatModeratorActionService(ChatModeratorActionRepository chatModeratorActionRepository, UserRepository userRepository, RateLimitService rateLimitService) {
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.userRepository = userRepository;

        this.rateLimitService = rateLimitService;
    }

    public List<ChatModeratorActionRepresentation> get(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<ChatModeratorAction> actions = chatModeratorActionRepository.findAllWithUsersPageable(before, pageable);

        return actions.stream().map(ChatModeratorActionRepresentation::new).toList();
    }
}
