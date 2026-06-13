package com.example.phantom.chat;

import com.example.phantom.chat.banlist.Ban;
import com.example.phantom.chat.banlist.BanRepository;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorAction;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionRepository;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionType;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.LevelFeature;
import com.example.phantom.experience.LevelFeatureService;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
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
    private final LevelFeatureService levelFeatureService;
    private final MessageRepository messageRepository;
    private final BanRepository banRepository;
    private final ChatModeratorActionRepository chatModeratorActionRepository;
    private final ProfileService profileService;

    private final RateLimitService rateLimitService;

    public ChatService(UserRepository userRepository, LevelFeatureService levelFeatureService, MessageRepository messageRepository, BanRepository banRepository, ChatModeratorActionRepository chatModeratorActionRepository, ProfileService profileService, RateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.levelFeatureService = levelFeatureService;
        this.messageRepository = messageRepository;
        this.banRepository = banRepository;
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.profileService = profileService;

        this.rateLimitService = rateLimitService;
    }

    public List<MessageRepresentation> get(Long userId, Integer limit, Long before) {
        User user = getUser(userId);

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Message> messages = messageRepository.findAllWithUsersPageable(before, pageable);

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
            throw new ApiException(ErrorCode.BANNED);
        }

        if (!user.getRole().getChatModeratorAccess()) {
            levelFeatureService.validateAccess(userId, LevelFeature.SEND_MESSAGE);
        }

        rateLimitService.startAction(user.getId(), RateLimitAction.SEND_MESSAGE, 1L);

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
            if (user.getRole().getChatModeratorAccess()) {
                if (message.getUser().getRole().getChatModeratorAccess()) {
                    throw new ApiException(ErrorCode.NO_PERMISSION);
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
                throw new ApiException(ErrorCode.NO_PERMISSION);
            }
        }

        messageRepository.delete(message);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private Message getMessage(Long messageId) {
        return messageRepository.findById(messageId).orElseThrow(() -> new ApiException(ErrorCode.MESSAGE_NOT_FOUND));
    }
}
