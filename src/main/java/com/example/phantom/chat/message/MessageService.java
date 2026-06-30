package com.example.phantom.chat.message;

import com.example.phantom.chat.banlist.BanlistService;
import com.example.phantom.chat.blacklist.BlacklistService;
import com.example.phantom.chat.chat.Chat;
import com.example.phantom.chat.chat.ChatRepository;
import com.example.phantom.chat.chat.ChatRepresentation;
import com.example.phantom.chat.chat.ChatType;
import com.example.phantom.disk.File;
import com.example.phantom.disk.FileRepository;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.topic.TopicAccessService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.topic.TopicMember;
import com.example.phantom.topic.TopicMemberRepository;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Slf4j
public class MessageService {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final TopicAccessService topicAccessService;
    private final TopicMemberRepository topicMemberRepository;
    private final MessageRepository messageRepository;
    private final BanlistService banlistService;
    private final BlacklistService blacklistService;
    private final FileRepository fileRepository;
    private final RateLimitService rateLimitService;
    private final NotificationPublishService notificationPublishService;

    public MessageService(UserRepository userRepository, ChatRepository chatRepository, TopicAccessService topicAccessService, TopicMemberRepository topicMemberRepository, MessageRepository messageRepository, BanlistService banlistService, BlacklistService blacklistService, RateLimitService rateLimitService, FileRepository fileRepository, NotificationPublishService notificationPublishService) {
        this.userRepository = userRepository;
        this.chatRepository = chatRepository;
        this.topicAccessService = topicAccessService;
        this.topicMemberRepository = topicMemberRepository;
        this.messageRepository = messageRepository;
        this.banlistService = banlistService;
        this.blacklistService = blacklistService;
        this.fileRepository = fileRepository;
        this.rateLimitService = rateLimitService;
        this.notificationPublishService = notificationPublishService;
    }

    public List<MessageRepresentation> get(Long userId, UUID chatId, Integer limit, Long before) {
        User user = getUser(userId);
        Chat chat = getChat(chatId, user);

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Message> messages = messageRepository.findByChatIdWithAttachmentsAndUsersAndChatsPageable(chat.getId(), before, pageable);

        return messages.stream().map(MessageRepresentation::new).toList();
    }

    @Transactional
    public MessageRepresentation sendMessage(Long userId, SendMessageRequest request) {
        User user = getUser(userId);
        Chat chat = getChat(request.getChatId(), user);
        if (chat.getType() == ChatType.P2) {
            List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
            chatMembers.removeIf(tm -> Objects.equals(tm.getUser().getId(), user.getId()));
            chatMembers.stream().findFirst().ifPresent(target -> blacklistService.validate(user.getId(), target.getUser().getId()));
        }

        banlistService.validateChatPermission(userId);

        rateLimitService.startAction(user.getId(), RateLimitAction.SEND_MESSAGE, 1L);

        String content = request.getContent();

        UUID attachmentId = request.getAttachmentId();
        File attachment = null;
        if (attachmentId != null) attachment = fileRepository.findById(attachmentId).orElseThrow(() -> new ApiException(ErrorCode.FILE_NOT_FOUND));

        if (content.isBlank() && attachment == null) {
            throw new ApiException(ErrorCode.EMPTY_REQUEST);
        }

        chat.setLastEdit(Math.max(chat.getLastEdit(), Instant.now().getEpochSecond()));
        chat = chatRepository.save(chat);

        Message message = new Message();
        message.setUser(user);
        message.setChat(chat);
        message.setTimestamp(Instant.now().getEpochSecond());
        message.setContent(content);
        message.setAttachment(attachment);
        message = messageRepository.save(message);

        MessageRepresentation representation = new MessageRepresentation(message);
        notificationPublishService.createTopicNotification(chat.getTopic(), NotificationType.MESSAGE_RECEIVED, representation);
        log.info("sent message for user {}", userId);
        return representation;
    }

    @Transactional
    public void deleteMessage(Long userId, Long messageId) {
        User user = getUser(userId);
        Message message = getMessage(messageId);

        if (!Objects.equals(user.getId(), message.getUser().getId())) {
            if (user.getRole().getChatModeratorAccess() && !message.getUser().getRole().getChatModeratorAccess() && message.getChat().getTopic().getAllowAuthorized()) {
                notificationPublishService.createUserNotification(message.getUser(), NotificationType.YOUR_MESSAGE_DELETED, new UserShortRepresentation(user));
            }
            else {
                throw new ApiException(ErrorCode.NO_PERMISSION);
            }
        }

        MessageRepresentation representation = new MessageRepresentation(message);
        messageRepository.delete(message);
        notificationPublishService.createTopicNotification(message.getChat().getTopic(), NotificationType.MESSAGE_DELETED, representation);
        log.info("message of user {} deleted for user {}", representation.getUser().getId(), userId);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private Chat getChat(UUID chatId, User user) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        if (!topicAccessService.canReadTopic(user.getId(), chat.getTopic().getId())) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return chat;
    }

    private Message getMessage(Long messageId) {
        return messageRepository.findById(messageId).orElseThrow(() -> new ApiException(ErrorCode.MESSAGE_NOT_FOUND));
    }
}
