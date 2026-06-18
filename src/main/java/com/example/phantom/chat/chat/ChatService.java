package com.example.phantom.chat.chat;

import com.example.phantom.chat.blacklist.BlacklistService;
import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
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

    public ChatService(UserRepository userRepository, ChatRepository chatRepository, TopicRepository topicRepository, TopicMemberRepository topicMemberRepository, TopicBuilderService topicBuilderService, RateLimitService rateLimitService, Random chatIdsGenerator, BlacklistService blacklistService) {
        this.userRepository = userRepository;
        this.chatRepository = chatRepository;
        this.topicRepository = topicRepository;
        this.topicMemberRepository = topicMemberRepository;
        this.topicBuilderService = topicBuilderService;
        this.rateLimitService = rateLimitService;
        this.chatIdsGenerator = chatIdsGenerator;
        this.blacklistService = blacklistService;
    }

    @Transactional
    public ChatRepresentation post(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        rateLimitService.startAction(user.getId(), RateLimitAction.CREATE_CHAT, 1);

        Long id = chatIdsGenerator.nextLong();

        Topic topic = topicBuilderService.build("chat-" + id, false, false, false, true);
        topicRepository.save(topic);

        TopicMember chatMember = new TopicMember();
        chatMember.setTimestamp(Instant.now().getEpochSecond());
        chatMember.setTopic(topic);
        chatMember.setUser(user);
        topicMemberRepository.save(chatMember);

        Chat chat = new Chat();
        chat.setId(id);
        chat.setTopic(topic);
        chatRepository.save(chat);

        log.info("user {} created the chat", userId);
        return new ChatRepresentation(chat, List.of(new UserShortRepresentation(user)));
    }

    public List<ChatRepresentation> get(Long userId, Integer limit, Long before) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<TopicMember> chatMembers = topicMemberRepository.findByUserIdWithTopics(userId);
        List<String> chatMemberTopicIds = chatMembers.stream().map(TopicMember::getTopic).map(Topic::getId).toList();

        List<Chat> chats = chatRepository.findByTopicIdsWithTopics(chatMemberTopicIds, before, pageable);
        List<String> chatTopicIds = chats.stream().map(Chat::getTopic).map(Topic::getId).toList();

        List<TopicMember> globalChatMembers = topicMemberRepository.findByTopicIdsWithUsersTopics(chatTopicIds);
        Map<String, List<UserShortRepresentation>> globalUsersMap = new HashMap<>();
        for (TopicMember tm : globalChatMembers) {
            globalUsersMap.putIfAbsent(tm.getTopic().getId(), new ArrayList<>());
            globalUsersMap.get(tm.getTopic().getId()).add(new UserShortRepresentation(tm.getUser()));
        }

        return chats.stream().map(c -> new ChatRepresentation(c, globalUsersMap.get(c.getTopic().getId()))).toList();
    }

    public ChatRepresentation getChat(Long userId, Long chatId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
        validateMembership(userId, chatMembers);

        return new ChatRepresentation(chat, chatMembers.stream().map(TopicMember::getUser).map(UserShortRepresentation::new).toList());
    }

    @Transactional
    public Void leave(Long userId, Long chatId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        Topic chatTopic = chat.getTopic();
        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
        validateMembership(userId, chatMembers);

        if (chatMembers.size() == 1) {
            chatRepository.delete(chat);
            topicRepository.delete(chatTopic);
            log.info("user {} was the last chat member and they decided to leave the chat so the chat will be deleted", userId);
        }
        else {
            for (TopicMember tm : chatMembers) {
                if (Objects.equals(tm.getUser().getId(), userId)) {
                    topicMemberRepository.delete(tm);
                    log.info("user {} left the chat", userId);
                    break;
                }
            }
        }

        return null;
    }

    @Transactional
    public void delete(Long userId, Long chatId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        Topic chatTopic = chat.getTopic();
        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
        validateElderMembership(userId, chatMembers);

        chatRepository.delete(chat);
        topicRepository.delete(chatTopic);
        log.info("user {} deleted the chat", userId);
    }

    @Transactional
    public ChatRepresentation kick(Long userId, Long chatId, Long targetId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
        validateElderMembership(userId, chatMembers);

        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_SELF_KICK);
        }

        for (TopicMember tm : chatMembers) {
            if (Objects.equals(tm.getUser().getId(), targetId)) {
                topicMemberRepository.delete(tm);
                chatMembers.remove(tm);
                log.info("user {} kicked another user", userId);
                break;
            }
        }

        return new ChatRepresentation(chat, chatMembers.stream().map(TopicMember::getUser).map(UserShortRepresentation::new).toList());
    }

    @Transactional
    public ChatRepresentation add(Long userId, Long chatId, Long targetId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        List<TopicMember> chatMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());
        validateElderMembership(userId, chatMembers);
        User target = userRepository.findById(targetId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        if (Objects.equals(userId, targetId)) {
            throw new ApiException(ErrorCode.CANT_SELF_ADD);
        }

        blacklistService.validateMessage(userId, targetId);
        rateLimitService.startAction(userId, RateLimitAction.INVITE_TO_CHAT, 1L);

        TopicMember chatMember;
        try {
            chatMember = new TopicMember();
            chatMember.setTimestamp(Instant.now().getEpochSecond());
            chatMember.setTopic(chat.getTopic());
            chatMember.setUser(target);
            topicMemberRepository.save(chatMember);
        }
        catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.ALREADY_ADDED);
        }

        log.info("user {} added another user", userId);

        chatMembers.add(chatMember);
        return new ChatRepresentation(chat, chatMembers.stream().map(TopicMember::getUser).map(UserShortRepresentation::new).toList());
    }

    private void validateMembership(Long userId, List<TopicMember> chatMembers) {
        if (!checkUserMembership(userId, chatMembers)) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
    }

    private boolean checkUserMembership(Long userId, List<TopicMember> chatMembers) {
        for (TopicMember tm : chatMembers) {
            if (Objects.equals(tm.getUser().getId(), userId)) {
                return true;
            }
        }
        return false;
    }

    private void validateElderMembership(Long userId, List<TopicMember> chatMembers) {
        TopicMember currentMember = null;
        TopicMember elderMember = null;
        for (TopicMember tm : chatMembers) {
            if (Objects.equals(tm.getUser().getId(), userId)) {
                currentMember = tm;
            }
            if (elderMember == null || tm.getTimestamp() < elderMember.getTimestamp()) {
                elderMember = tm;
            }
        }

        if (currentMember == null || elderMember == null || !Objects.equals(currentMember.getUser().getId(), elderMember.getUser().getId())) {
            log.info("access rejected: user {} is not an elder member", userId);
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
    }
}
