package com.example.phantom.chat.chat;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.topic.*;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Random;

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

    public ChatService(UserRepository userRepository, ChatRepository chatRepository, TopicRepository topicRepository, TopicMemberRepository topicMemberRepository, TopicBuilderService topicBuilderService, RateLimitService rateLimitService, Random chatIdsGenerator) {
        this.userRepository = userRepository;
        this.chatRepository = chatRepository;
        this.topicRepository = topicRepository;
        this.topicMemberRepository = topicMemberRepository;
        this.topicBuilderService = topicBuilderService;
        this.rateLimitService = rateLimitService;
        this.chatIdsGenerator = chatIdsGenerator;
    }

    @Transactional
    public Void createChat(Long userId) {
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
        // TODO chat representation
        return null;
    }
}
