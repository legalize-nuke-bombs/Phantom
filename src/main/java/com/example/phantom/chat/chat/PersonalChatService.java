package com.example.phantom.chat.chat;

import com.example.phantom.chat.banlist.BanlistService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.topic.*;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Slf4j
public class PersonalChatService {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final TopicRepository topicRepository;
    private final TopicMemberRepository topicMemberRepository;
    private final TopicBuilderService topicBuilderService;
    private final RateLimitService rateLimitService;
    private final BanlistService banlistService;
    private final NotificationPublishService notificationPublishService;
    private final Long maxMembers;

    public PersonalChatService(UserRepository userRepository, ChatRepository chatRepository, TopicRepository topicRepository, TopicMemberRepository topicMemberRepository, TopicBuilderService topicBuilderService, RateLimitService rateLimitService, BanlistService banlistService, NotificationPublishService notificationPublishService, @Value("${chats.max-members}") @NotNull Long maxMembers) {
        this.userRepository = userRepository;
        this.chatRepository = chatRepository;
        this.topicRepository = topicRepository;
        this.topicMemberRepository = topicMemberRepository;
        this.topicBuilderService = topicBuilderService;
        this.rateLimitService = rateLimitService;
        this.banlistService = banlistService;
        this.notificationPublishService = notificationPublishService;
        this.maxMembers = maxMembers;
        log.info("initialization, max members {}", maxMembers);
    }

    @Transactional
    public ChatRepresentation post(Long userId, PostChatRequest request) {
        banlistService.validateChatPermission(userId);

        ChatType type = request.getType();
        String name = request.getName();
        List<Long> userIds = request.getUserIds();
        if (userIds == null) {
            userIds = new ArrayList<>();
        }

        UUID id;
        switch (type) {
            case FAVORITES -> {
                if (!userIds.isEmpty() || name != null) {
                    log.info("user {} couldn't create the favorites chat: malformed request", userId);
                    throw new ApiException(ErrorCode.INVALID_CHAT_TYPE);
                }
                id = buildFavoriteId(userId);
            }
            case P2 -> {
                if (userIds.size() != 1 || name != null) {
                    log.info("user {} couldn't create the p2 chat: malformed request", userId);
                    throw new ApiException(ErrorCode.INVALID_CHAT_TYPE);
                }
                id = buildP2Id(userId, userIds.get(0));
            }
            case GROUP -> {
                if (name == null) {
                    log.info("user {} couldn't create the group chat: malformed request", userId);
                    throw new ApiException(ErrorCode.INVALID_CHAT_TYPE);
                }
                id = buildRandomId();
            }
            default -> {
                throw new ApiException(ErrorCode.INVALID_CHAT_TYPE);
            }
        }

        if (userIds.size() + 1 > maxMembers) {
            log.info("user {} couldn't create the chat: too many members", userId);
            throw new ApiException(ErrorCode.TOO_MANY_MEMBERS);
        }

        Topic topic = topicBuilderService.build(PersonalChatConstants.TOPIC_PREFIX + id, false, false, false, true);
        topic = topicRepository.save(topic);

        if (chatRepository.insertIfNotExists(id, topic.getId(), type.name(), name, topic.getTimestamp()) == 0) {
            log.info("user {} couldn't create the chat: chat already exists", userId);
            throw new ApiException(ErrorCode.CHAT_ALREADY_EXISTS);
        }

        rateLimitService.startAction(userId, RateLimitAction.CREATE_CHAT, 1);
        rateLimitService.startAction(userId, RateLimitAction.INVITE_TO_CHAT, userIds.size());

        userIds.add(0, userId);
        List<TopicMember> chatMembers = new ArrayList<>();
        for (Long memberId : userIds) {
            try {
                TopicMember chatMember = new TopicMember();
                chatMember.setTimestamp(Instant.now().getEpochSecond());
                chatMember.setTopic(topic);
                chatMember.setUser(userRepository.findById(memberId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND)));
                chatMembers.add(topicMemberRepository.save(chatMember));
            }
            catch (DataIntegrityViolationException e) {
                throw new ApiException(ErrorCode.ALREADY_ADDED);
            }
        }

        log.info("user {} created the chat", userId);
        return new ChatRepresentation(
                chatRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND)),
                chatMembers.stream().map(TopicMemberRepresentation::new).toList()
        );
    }

    public UUID buildFavoriteId(Long userId) {
        return new UUID(userId, userId);
    }

    public UUID buildP2Id(Long userId, Long targetId) {
        return new UUID(Math.min(userId, targetId), Math.max(userId, targetId));
    }

    public UUID buildRandomId() {
        return UUID.randomUUID();
    }

    public List<ChatRepresentation> get(Long userId) {
        List<TopicMember> chatMembers = topicMemberRepository.findByUserIdWithTopics(userId);
        List<String> chatMemberTopicIds = chatMembers.stream().map(TopicMember::getTopic).map(Topic::getId).filter(s -> s.startsWith(PersonalChatConstants.TOPIC_PREFIX)).toList();

        List<Chat> chats = chatRepository.findByTopicIdsWithTopics(chatMemberTopicIds, null, null, Pageable.unpaged());
        List<String> chatTopicIds = chats.stream().map(Chat::getTopic).map(Topic::getId).toList();

        List<TopicMember> globalChatMembers = topicMemberRepository.findByTopicIdsWithUsersTopics(chatTopicIds);
        Map<String, List<TopicMemberRepresentation>> globalChatMemberMap = new HashMap<>();
        for (TopicMember tm : globalChatMembers) {
            globalChatMemberMap.putIfAbsent(tm.getTopic().getId(), new ArrayList<>());
            globalChatMemberMap.get(tm.getTopic().getId()).add(new TopicMemberRepresentation(tm));
        }

        return chats.stream().map(c -> new ChatRepresentation(c, globalChatMemberMap.get(c.getTopic().getId()))).sorted(Comparator.comparing(ChatRepresentation::getLastEdit).reversed()).toList();
    }

    public ChatRepresentation getChat(Long userId, UUID chatId) {
        Chat chat = getChat(chatId);
        validateMembership(userId, chat.getTopic().getId());

        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
        return new ChatRepresentation(chat, chatMembers.stream().map(TopicMemberRepresentation::new).toList());
    }

    public ChatRepresentation getFavoriteChat(Long userId) {
        return getChat(userId, buildFavoriteId(userId));
    }

    public ChatRepresentation getP2Chat(Long userId, Long targetId) {
        return getChat(userId, buildP2Id(userId, targetId));
    }

    @Transactional
    public Void leave(Long userId, UUID chatId) {
        Chat chat = lockChat(chatId);
        String topicId = chat.getTopic().getId();
        validateMembership(userId, topicId);

        switch (chat.getType()) {
            case FAVORITES, P2 -> {
                log.info("user {} couldn't leave chat {}", userId, chat.getType());
                throw new ApiException(ErrorCode.CANT_LEAVE_THE_CHAT);
            }
            case GROUP -> {
                if (topicMemberRepository.countByTopicId(topicId) == 1) {
                    topicRepository.delete(chat.getTopic());
                    log.info("user {} was the last member of the group chat and left, so the chat was deleted", userId);
                }
                else {
                    topicMemberRepository.deleteByTopic_IdAndUser_Id(topicId, userId);
                    log.info("user {} left the group chat", userId);
                }
            }
            default -> {
                throw new ApiException(ErrorCode.INVALID_CHAT_TYPE);
            }
        }

        return null;
    }

    @Transactional
    public void delete(Long userId, UUID chatId) {
        Chat chat = lockChat(chatId);
        switch (chat.getType()) {
            case FAVORITES, P2 -> {
                validateMembership(userId, chat.getTopic().getId());
            }
            case GROUP -> {
                validateEldership(userId, chat.getTopic().getId());
            }
            default -> {
                throw new ApiException(ErrorCode.INVALID_CHAT_TYPE);
            }
        }

        topicRepository.delete(chat.getTopic());
        log.info("user {} deleted the chat", userId);
    }

    @Transactional
    public ChatRepresentation kick(Long userId, UUID chatId, Long targetId) {
        Chat chat = lockChat(chatId);

        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_SELF_KICK);
        }

        switch (chat.getType()) {
            case GROUP -> {
                validateEldership(userId, chat.getTopic().getId());
            }
            default -> {
                throw new ApiException(ErrorCode.INVALID_CHAT_TYPE);
            }
        }

        topicMemberRepository.deleteByTopic_IdAndUser_Id(chat.getTopic().getId(), targetId);

        log.info("user {} kicked another user", userId);
        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
        return new ChatRepresentation(chat, chatMembers.stream().map(TopicMemberRepresentation::new).toList());
    }

    @Transactional
    public ChatRepresentation add(Long userId, UUID chatId, Long targetId) {
        Chat chat = lockChat(chatId);
        String topicId = chat.getTopic().getId();

        switch (chat.getType()) {
            case GROUP -> {
                validateEldership(userId, topicId);
            }
            default -> {
                throw new ApiException(ErrorCode.INVALID_CHAT_TYPE);
            }
        }

        banlistService.validateChatPermission(userId);

        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_SELF_ADD);
        }

        if (topicMemberRepository.countByTopicId(chat.getTopic().getId()) >= maxMembers) {
            throw new ApiException(ErrorCode.TOO_MANY_MEMBERS);
        }

        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        rateLimitService.startAction(userId, RateLimitAction.INVITE_TO_CHAT, 1L);

        try {
            TopicMember chatMember = new TopicMember();
            chatMember.setTimestamp(Instant.now().getEpochSecond());
            chatMember.setTopic(chat.getTopic());
            chatMember.setUser(target);
            topicMemberRepository.save(chatMember);
        }
        catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.ALREADY_ADDED);
        }

        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(topicId);
        ChatRepresentation representation = new ChatRepresentation(chat, chatMembers.stream().map(TopicMemberRepresentation::new).toList());
        log.info("user {} added another user", userId);
        notificationPublishService.createUserNotification(target, NotificationType.NEW_CHAT, representation);
        return representation;
    }

    private Chat getChat(UUID chatId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        if (!chat.getTopic().getId().startsWith(PersonalChatConstants.TOPIC_PREFIX)) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return chat;
    }

    private Chat lockChat(UUID chatId) {
        Chat chat =  chatRepository.findByIdForPessimisticWrite(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        if (!chat.getTopic().getId().startsWith(PersonalChatConstants.TOPIC_PREFIX)) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return chat;
    }

    private void validateMembership(Long userId, String topicId) {
        if (!topicMemberRepository.existsByTopicIdUserId(topicId, userId)) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
    }

    private void validateEldership(Long userId, String topicId) {
        List<TopicMember> eldest = topicMemberRepository.findEldest(topicId, PageRequest.of(0, 1));
        if (eldest.isEmpty() || !Objects.equals(eldest.get(0).getUser().getId(), userId)) {
            log.info("access rejected: user {} is not the eldest member", userId);
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
    }

    @Scheduled(fixedDelay = 8L * 3600 * 1000)
    public void clean() {
        cleanEmptyChats();
        cleanAbandonedChatTopics();
    }

    private void cleanEmptyChats() {
        log.info("starting cleaning empty chats...");
        long total = 0;
        while (true) {
            List<String> topicIds = chatRepository.findEmptyChatTopicIds(PageRequest.of(0, 100));
            if (topicIds.isEmpty()) {
                break;
            }
            topicRepository.deleteAllById(topicIds);
            total += topicIds.size();
        }
        log.info("empty chats cleaning finished, deleted {}", total);
    }

    private void cleanAbandonedChatTopics() {
        log.info("starting cleaning abandoned chat topics...");
        long total = 0;
        while (true) {
            List<String> topicIds = chatRepository.findAbandonedChatTopicIds(PageRequest.of(0, 100));
            if (topicIds.isEmpty()) {
                break;
            }
            topicRepository.deleteAllById(topicIds);
            total += topicIds.size();
        }
        log.info("abandoned chat topics cleaning finished, deleted {}", total);
    }
}
