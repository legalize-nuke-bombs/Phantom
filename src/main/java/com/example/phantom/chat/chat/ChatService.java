package com.example.phantom.chat.chat;

import com.example.phantom.chat.blacklist.BlacklistService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.notification.topic.*;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import lombok.extern.slf4j.Slf4j;
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
public class ChatService {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final TopicRepository topicRepository;
    private final TopicMemberRepository topicMemberRepository;
    private final TopicBuilderService topicBuilderService;
    private final RateLimitService rateLimitService;
    private final Random chatIdsGenerator;
    private final BlacklistService blacklistService;
    private final NotificationPublishService notificationPublishService;

    public ChatService(UserRepository userRepository, ChatRepository chatRepository, TopicRepository topicRepository, TopicMemberRepository topicMemberRepository, TopicBuilderService topicBuilderService, RateLimitService rateLimitService, Random chatIdsGenerator, BlacklistService blacklistService, NotificationPublishService notificationPublishService) {
        this.userRepository = userRepository;
        this.chatRepository = chatRepository;
        this.topicRepository = topicRepository;
        this.topicMemberRepository = topicMemberRepository;
        this.topicBuilderService = topicBuilderService;
        this.rateLimitService = rateLimitService;
        this.chatIdsGenerator = chatIdsGenerator;
        this.blacklistService = blacklistService;
        this.notificationPublishService = notificationPublishService;
    }

    @Transactional
    public ChatRepresentation post(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        rateLimitService.startAction(user.getId(), RateLimitAction.CREATE_CHAT, 1);

        Long id = chatIdsGenerator.nextLong();

        Topic topic = topicBuilderService.build(ChatConstants.PERSONAL_CHAT_PREFIX + id, false, false, false, true);
        topicRepository.save(topic);

        TopicMember chatMember = new TopicMember();
        chatMember.setTimestamp(Instant.now().getEpochSecond());
        chatMember.setTopic(topic);
        chatMember.setUser(user);
        chatMember = topicMemberRepository.save(chatMember);

        Chat chat = new Chat();
        chat.setId(id);
        chat.setTopic(topic);
        chatRepository.save(chat);

        log.info("user {} created the chat", userId);
        return new ChatRepresentation(chat, List.of(new TopicMemberRepresentation(chatMember)));
    }

    public List<ChatRepresentation> get(Long userId, Integer limit, Long beforeTimestamp, Long beforeId) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<TopicMember> chatMembers = topicMemberRepository.findByUserIdWithTopics(userId);
        List<String> chatMemberTopicIds = chatMembers.stream().map(TopicMember::getTopic).map(Topic::getId).toList();

        List<Chat> chats = chatRepository.findByTopicIdsWithTopics(chatMemberTopicIds, beforeTimestamp, beforeId, pageable);
        List<String> chatTopicIds = chats.stream().map(Chat::getTopic).map(Topic::getId).toList();

        List<TopicMember> globalChatMembers = topicMemberRepository.findByTopicIdsWithUsersTopics(chatTopicIds);
        Map<String, List<TopicMemberRepresentation>> globalChatMemberMap = new HashMap<>();
        for (TopicMember tm : globalChatMembers) {
            globalChatMemberMap.putIfAbsent(tm.getTopic().getId(), new ArrayList<>());
            globalChatMemberMap.get(tm.getTopic().getId()).add(new TopicMemberRepresentation(tm));
        }

        return chats.stream().map(c -> new ChatRepresentation(c, globalChatMemberMap.get(c.getTopic().getId()))).toList();
    }

    public ChatRepresentation getChat(Long userId, Long chatId) {
        Chat chat = getChat(chatId);
        validateMembership(userId, chat.getTopic().getId());

        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
        return new ChatRepresentation(chat, chatMembers.stream().map(TopicMemberRepresentation::new).toList());
    }

    @Transactional
    public Void leave(Long userId, Long chatId) {
        Chat chat = getChat(chatId);
        String topicId = chat.getTopic().getId();
        validateMembership(userId, topicId);

        if (topicMemberRepository.countByTopicId(topicId) == 1) {
            topicRepository.delete(chat.getTopic());
            log.info("user {} was the last member and left, so the chat is deleted", userId);
        }
        else {
            topicMemberRepository.deleteByTopicIdUserId(topicId, userId);
            log.info("user {} left the chat", userId);
        }

        return null;
    }

    @Transactional
    public void delete(Long userId, Long chatId) {
        Chat chat = getChat(chatId);
        validateEldership(userId, chat.getTopic().getId());

        topicRepository.delete(chat.getTopic());
        log.info("user {} deleted the chat", userId);
    }

    @Transactional
    public ChatRepresentation kick(Long userId, Long chatId, Long targetId) {
        Chat chat = getChat(chatId);
        String topicId = chat.getTopic().getId();
        validateEldership(userId, topicId);

        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_SELF_KICK);
        }

        topicMemberRepository.deleteByTopicIdUserId(topicId, targetId);
        log.info("user {} kicked another user", userId);

        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(topicId);
        return new ChatRepresentation(chat, chatMembers.stream().map(TopicMemberRepresentation::new).toList());
    }

    @Transactional
    public ChatRepresentation add(Long userId, Long chatId, Long targetId) {
        Chat chat = getChat(chatId);
        String topicId = chat.getTopic().getId();
        validateEldership(userId, topicId);

        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_SELF_ADD);
        }

        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        blacklistService.validateMessage(userId, targetId);
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

    private Chat getChat(Long chatId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        if (!chat.getTopic().getAllowCustomMembers()) {
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
