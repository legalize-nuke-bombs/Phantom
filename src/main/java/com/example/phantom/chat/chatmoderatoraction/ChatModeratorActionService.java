package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
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
    private final ProfileService profileService;

    private final RateLimitService rateLimitService;

    public ChatModeratorActionService(ChatModeratorActionRepository chatModeratorActionRepository, UserRepository userRepository, ProfileService profileService, RateLimitService rateLimitService) {
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.userRepository = userRepository;
        this.profileService = profileService;

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

        Map<Long, ProfileCardRepresentation> cardsByUserId = profileService.getCardsForUsers(userId, users);

        List<ChatModeratorActionRepresentation> actionRepresentations = new ArrayList<>();
        for (ChatModeratorAction action : actions) {
            actionRepresentations.add(new ChatModeratorActionRepresentation(
                    action,
                    action.getUser() != null
                    ? cardsByUserId.get(action.getUser().getId())
                    : null
            ));
        }
        return actionRepresentations;
    }
}
