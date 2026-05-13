package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.exception.UnauthorizedException;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimiter;
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

    private final UsageLimiter usageLimiter;

    public ChatModeratorActionService(ChatModeratorActionRepository chatModeratorActionRepository, UserRepository userRepository, UsageLimiter usageLimiter) {
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.userRepository = userRepository;

        this.usageLimiter = usageLimiter;
    }

    public List<ChatModeratorActionRepresentation> get(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("user not found"));

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<ChatModeratorAction> actions = before != null
                ? chatModeratorActionRepository.findAllBeforeWithUsersPageable(before, pageable)
                : chatModeratorActionRepository.findAllWithUsersPageable(pageable);

        return actions.stream().map(ChatModeratorActionRepresentation::new).toList();
    }
}
