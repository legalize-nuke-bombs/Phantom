package com.example.phantom.chat;

import com.example.phantom.chat.banlist.Ban;
import com.example.phantom.chat.banlist.BanRepository;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorAction;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionRepository;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionRepresentation;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionType;
import com.example.phantom.disk.File;
import com.example.phantom.disk.FileRepository;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.LevelFeature;
import com.example.phantom.experience.LevelFeatureService;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class ChatService {

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final BanRepository banRepository;
    private final ChatModeratorActionRepository chatModeratorActionRepository;
    private final FileRepository fileRepository;
    private final RateLimitService rateLimitService;
    private final NotificationPublishService notificationPublishService;

    public ChatService(UserRepository userRepository, MessageRepository messageRepository, BanRepository banRepository, ChatModeratorActionRepository chatModeratorActionRepository, RateLimitService rateLimitService, FileRepository fileRepository, NotificationPublishService notificationPublishService) {
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.banRepository = banRepository;
        this.chatModeratorActionRepository = chatModeratorActionRepository;
        this.fileRepository = fileRepository;
        this.rateLimitService = rateLimitService;
        this.notificationPublishService = notificationPublishService;
    }

    public List<MessageRepresentation> get(Long userId, Integer limit, Long before) {
        User user = getUser(userId);

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Message> messages = messageRepository.findAllWithAttachmentsAndUsersPageable(before, pageable);

        return messages.stream().map(MessageRepresentation::new).toList();
    }

    @Transactional
    public MessageRepresentation sendMessage(Long userId, SendMessageRequest request) {
        User user = getUser(userId);

        Ban ban = banRepository.findById(user.getId()).orElse(null);
        if (ban != null && ban.isActive()) {
            throw new ApiException(ErrorCode.BANNED);
        }

        rateLimitService.startAction(user.getId(), RateLimitAction.SEND_MESSAGE, 1L);

        String content = request.getContent();

        UUID attachmentId = request.getAttachmentId();
        File attachment = null;
        if (attachmentId != null) attachment = fileRepository.findById(attachmentId).orElseThrow(() -> new ApiException(ErrorCode.FILE_NOT_FOUND));

        if (content.isBlank() && attachment == null) {
            throw new ApiException(ErrorCode.EMPTY_REQUEST);
        }

        Message message = new Message();
        message.setUser(user);
        message.setTimestamp(Instant.now().getEpochSecond());
        message.setContent(content);
        message.setAttachment(attachment);
        message = messageRepository.save(message);

        return new MessageRepresentation(message);
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
                        "message_content", message.getContent(),
                        "message_attachment_id", message.getAttachment() != null ? message.getAttachment().getId().toString() : ""
                ));
                chatModeratorActionRepository.save(chatModeratorAction);

                notificationPublishService.createUserNotification(message.getUser(), NotificationType.YOUR_MESSAGE_DELETED, new ChatModeratorActionRepresentation(chatModeratorAction));
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
