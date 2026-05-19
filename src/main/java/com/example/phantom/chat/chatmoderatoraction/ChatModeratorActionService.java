package com.example.phantom.chat.chatmoderatoraction;

import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.exception.UnauthorizedException;
import com.example.phantom.experience.Experience;
import com.example.phantom.experience.ExperienceRepository;
import com.example.phantom.profile.ProfileCardRepresentation;
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
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ChatModeratorActionService {

    private final ChatModeratorActionRepository chatModeratorActionRepository;
    private final UserRepository userRepository;
    private final ExperienceRepository experienceRepository;

    private final UsageLimiter usageLimiter;

    public ChatModeratorActionService(ChatModeratorActionRepository chatModeratorActionRepository, UserRepository userRepository, ExperienceRepository experienceRepository, UsageLimiter usageLimiter) {
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.userRepository = userRepository;
        this.experienceRepository = experienceRepository;

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

        List<Long> userIds = new ArrayList<>();
        for (ChatModeratorAction action : actions) {
            if (action.getUser() != null) userIds.add(action.getUser().getId());
        }

        List<Experience> experiences = experienceRepository.findAllById(userIds);
        Map<Long, Experience> experienceMap = experiences.stream().collect(Collectors.toMap(Experience::getId, Function.identity()));

        List<ChatModeratorActionRepresentation> actionRepresentations = new ArrayList<>();
        for (ChatModeratorAction action : actions) {
            actionRepresentations.add(new ChatModeratorActionRepresentation(
                    action,
                    action.getUser() != null
                    ? new ProfileCardRepresentation(
                            action.getUser(),
                            experienceMap.get(action.getUser().getId())
                    )
                    : null
            ));
        }
        return actionRepresentations;
    }
}
