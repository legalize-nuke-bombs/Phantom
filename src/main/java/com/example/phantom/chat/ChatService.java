package com.example.phantom.chat;

import com.example.phantom.chat.banlist.Ban;
import com.example.phantom.chat.banlist.BanRepository;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorAction;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionRepository;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionType;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.experience.Experience;
import com.example.phantom.experience.ExperienceRepository;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ChatService {

    private final UserRepository userRepository;
    private final ExperienceRepository experienceRepository;
    private final MessageRepository messageRepository;
    private final BanRepository banRepository;
    private final ChatModeratorActionRepository chatModeratorActionRepository;
    private final ProfileService profileService;

    private final UsageLimiter usageLimiter;

    public ChatService(UserRepository userRepository, ExperienceRepository experienceRepository, MessageRepository messageRepository, BanRepository banRepository, ChatModeratorActionRepository chatModeratorActionRepository, ProfileService profileService, UsageLimiter usageLimiter) {
        this.userRepository = userRepository;
        this.experienceRepository = experienceRepository;
        this.messageRepository = messageRepository;
        this.banRepository = banRepository;
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.profileService = profileService;

        this.usageLimiter = usageLimiter;
    }

    public List<MessageRepresentation> get(Long userId, Integer limit, Long before) {
        User user = getUser(userId);

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<Message> messages = before != null
                ? messageRepository.findAllBeforeWithUsersPageable(before, pageable)
                : messageRepository.findAllWithUsersPageable(pageable);

        List<User> users = messages.stream().map(Message::getUser).toList();
        Map<Long, ProfileCardRepresentation> cardsByUserId = profileService.getCardsForUsers(userId, users);

        List<MessageRepresentation> messageRepresentations = new ArrayList<>();
        for (Message message : messages) {
            messageRepresentations.add(new MessageRepresentation(
                    message,
                    cardsByUserId.get(message.getUser().getId())
            ));
        }
        return messageRepresentations;
    }

    @Transactional
    public MessageRepresentation sendMessage(Long userId, SendMessageRequest request) {
        User user = getUser(userId);

        Ban ban = banRepository.findById(user.getId()).orElse(null);
        if (ban != null && ban.isActive()) {
            throw new ForbiddenException("you are banned");
        }

        if (!user.getRole().chatModeratorAccess()) {
            if (getExperience(user.getId()).getAmountCached() < ChatConstants.MIN_EXPERIENCE) {
                throw new ForbiddenException("min experience = " + ChatConstants.MIN_EXPERIENCE);
            }
        }

        try { usageLimiter.startAction(user, UsageAction.SEND_MESSAGE, 1L); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        String content = request.getContent();

        Message message = new Message();
        message.setUser(user);
        message.setTimestamp(Instant.now().getEpochSecond());
        message.setContent(content);
        message = messageRepository.save(message);

        return new MessageRepresentation(message, profileService.getCardForUser(userId, user));
    }

    @Transactional
    public void deleteMessage(Long userId, Long messageId) {
        User user = getUser(userId);
        Message message = getMessage(messageId);

        if (!Objects.equals(user.getId(), message.getUser().getId())) {
            if (user.getRole().chatModeratorAccess()) {
                if (message.getUser().getRole().chatModeratorAccess()) {
                    throw new ForbiddenException("you don't have permission to delete messages of this user");
                }
                ChatModeratorAction chatModeratorAction = new ChatModeratorAction();
                chatModeratorAction.setUser(user);
                chatModeratorAction.setTimestamp(Instant.now().getEpochSecond());
                chatModeratorAction.setType(ChatModeratorActionType.DELETE_MESSAGE);
                chatModeratorAction.setData(Map.of(
                        "user_id", String.valueOf(message.getUser().getId()),
                        "message_content", message.getContent()
                ));
                chatModeratorActionRepository.save(chatModeratorAction);
            }
            else {
                throw new ForbiddenException("you don't have permission to delete other user messages");
            }
        }

        messageRepository.delete(message);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }

    private Message getMessage(Long messageId) {
        return messageRepository.findById(messageId).orElseThrow(() -> new NotFoundException("message not found"));
    }

    private Experience getExperience(Long userId) {
        return experienceRepository.findById(userId).orElseThrow(() -> new NotFoundException("experience record not found"));
    }
}
