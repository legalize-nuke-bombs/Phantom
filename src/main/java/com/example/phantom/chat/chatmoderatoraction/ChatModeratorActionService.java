package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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

        List<User> users = new ArrayList<>();
        for (ChatModeratorAction action : actions) {
            if (action.getUser() != null) users.add(action.getUser());
        }

        Map<Long, UserShortRepresentation> usersById = users.stream().filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toMap(User::getId, UserShortRepresentation::new, (a, b) -> a));

        List<ChatModeratorActionRepresentation> actionRepresentations = new ArrayList<>();
        for (ChatModeratorAction action : actions) {
            actionRepresentations.add(new ChatModeratorActionRepresentation(
                    action,
                    action.getUser() != null
                    ? usersById.get(action.getUser().getId())
                    : null
            ));
        }
        return actionRepresentations;
    }
}
