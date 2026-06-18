package com.example.phantom.chat.chat;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.topic.*;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Slf4j
public class ChatService {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final TopicRepository topicRepository;
    private final TopicMemberRepository topicMemberRepository;
    private final TopicBuilderService topicBuilderService;
    private final TopicAccessService topicAccessService;
    private final RateLimitService rateLimitService;
    private final Random chatIdsGenerator;

    public ChatService(UserRepository userRepository, ChatRepository chatRepository, TopicRepository topicRepository, TopicMemberRepository topicMemberRepository, TopicBuilderService topicBuilderService, TopicAccessService topicAccessService, RateLimitService rateLimitService, Random chatIdsGenerator) {
        this.userRepository = userRepository;
        this.chatRepository = chatRepository;
        this.topicRepository = topicRepository;
        this.topicMemberRepository = topicMemberRepository;
        this.topicBuilderService = topicBuilderService;
        this.topicAccessService = topicAccessService;
        this.rateLimitService = rateLimitService;
        this.chatIdsGenerator = chatIdsGenerator;
    }

    @Transactional
    public ChatRepresentation post(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        rateLimitService.startAction(user.getId(), RateLimitAction.CREATE_CHAT, 1);

        Long id = chatIdsGenerator.nextLong();

        Topic topic = topicBuilderService.build("chat-" + id, false, false, false, true);
        topicRepository.save(topic);

        TopicMember topicMember = new TopicMember();
        topicMember.setTopic(topic);
        topicMember.setUser(user);
        topicMemberRepository.save(topicMember);

        Chat chat = new Chat();
        chat.setId(id);
        chat.setTopic(topic);
        chatRepository.save(chat);

        log.info("chat created for user {}", userId);
        return new ChatRepresentation(chat, List.of(new UserShortRepresentation(user)));
    }

    public List<ChatRepresentation> get(Long userId, Integer limit, Long before) {
        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<TopicMember> topicMembers = topicMemberRepository.findByUserIdWithTopics(userId);
        List<String> topicMembersTopicIds = topicMembers.stream().map(TopicMember::getTopic).map(Topic::getId).toList();

        List<Chat> chats = chatRepository.findByTopicIdsWithTopics(topicMembersTopicIds, before, pageable);
        List<String> chatTopicIds = chats.stream().map(Chat::getTopic).map(Topic::getId).toList();

        List<TopicMember> globalTopicMembers = topicMemberRepository.findByTopicIdsWithUsersTopics(chatTopicIds);
        Map<String, List<UserShortRepresentation>> usersMap = new HashMap<>();
        for (TopicMember tm : globalTopicMembers) {
            usersMap.putIfAbsent(tm.getTopic().getId(), new ArrayList<>());
            usersMap.get(tm.getTopic().getId()).add(new UserShortRepresentation(tm.getUser()));
        }

        return chats.stream().map(c -> new ChatRepresentation(c, usersMap.get(c.getTopic().getId()))).toList();
    }

    public ChatRepresentation getChat(Long userId, Long chatId) {
        Chat chat = getVisibleChat(userId, chatId);

        List<TopicMember> topicMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());

        return new ChatRepresentation(chat, topicMembers.stream().map(TopicMember::getUser).map(UserShortRepresentation::new).toList());
    }

    @Transactional
    public Void leaveChat(Long userId, Long chatId) {
        Chat chat = getVisibleChat(userId, chatId);
        Topic chatTopic = chat.getTopic();

        List<TopicMember> topicMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());

        if (topicMembers.size() == 1) {
            chatRepository.delete(chat);
            topicRepository.delete(chatTopic);
            log.info("user {} was the last chat member and they decided to leave the chat so the chat will be deleted", userId);
        }
        else {
            for (TopicMember tm : topicMembers) {
                if (Objects.equals(tm.getUser().getId(), userId)) {
                    topicMemberRepository.delete(tm);
                    log.info("user {} left chat", userId);
                    break;
                }
            }
        }

        return null;
    }

    private Chat getVisibleChat(Long userId, Long chatId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        if (!topicAccessService.canReadTopic(userId, chat.getTopic().getId())) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return chat;
    }
}
