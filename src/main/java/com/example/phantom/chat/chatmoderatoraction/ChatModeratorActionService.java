package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.ratelimit.RateLimitReached;
import com.example.phantom.ratelimit.RateLimiter;
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

    private final RateLimiter rateLimiter;

    public ChatModeratorActionService(ChatModeratorActionRepository chatModeratorActionRepository, UserRepository userRepository, RateLimiter rateLimiter) {
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.userRepository = userRepository;

        this.rateLimiter = rateLimiter;
    }

    public List<ChatModeratorActionRepresentation> get(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        try { rateLimiter.startAction(user, "pagination", Long.valueOf(limit)); }
        catch (RateLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<ChatModeratorAction> actions = before != null
                ? chatModeratorActionRepository.findAllBeforeWithUsersPageable(before, pageable)
                : chatModeratorActionRepository.findAllWithUsersPageable(pageable);

        return actions.stream().map(ChatModeratorActionRepresentation::new).toList();
    }
}
