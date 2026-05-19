package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.exception.UnauthorizedException;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimiter;
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

    private final UsageLimiter usageLimiter;

    public ChatModeratorActionService(ChatModeratorActionRepository chatModeratorActionRepository, UserRepository userRepository, ProfileService profileService, UsageLimiter usageLimiter) {
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.userRepository = userRepository;
        this.profileService = profileService;

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
