package com.example.phantom.chat.chat;

import com.example.phantom.notification.topic.TopicRepository;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ChatService {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final TopicRepository topicRepository;

    public ChatService(UserRepository userRepository, ChatRepository chatRepository, TopicRepository topicRepository) {
        this.userRepository = userRepository;
        this.chatRepository = chatRepository;
        this.topicRepository = topicRepository;
    }

    public Void createChat(Long userId) {
        return null;
    }
}
