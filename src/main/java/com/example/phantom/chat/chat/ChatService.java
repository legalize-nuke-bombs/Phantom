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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Random;

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

    public ChatRepresentation get(Long userId, Long chatId) {
        Chat chat = getChat(userId, chatId);

        List<TopicMember> topicMembers = topicMemberRepository.findByTopicIdWithUsers(chat.getTopic().getId());

        return new ChatRepresentation(chat, topicMembers.stream().map(TopicMember::getUser).map(UserShortRepresentation::new).toList());
    }

    private Chat getChat(Long userId, Long chatId) {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ApiException(ErrorCode.CHAT_NOT_FOUND));
        if (!topicAccessService.canReadTopic(userId, chat.getTopic().getId())) {
            throw new ApiException(ErrorCode.NO_PERMISSION);
        }
        return chat;
    }
}
