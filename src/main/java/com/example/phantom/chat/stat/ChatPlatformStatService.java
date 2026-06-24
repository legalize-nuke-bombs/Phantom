package com.example.phantom.chat.stat;

import com.example.phantom.chat.chat.ChatRepository;
import com.example.phantom.chat.message.MessageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ChatPlatformStatService {

    private final ChatRepository chatRepository;
    private final MessageRepository messageRepository;
    private volatile ChatPlatformStatRepresentation cache;

    public ChatPlatformStatService(ChatRepository chatRepository, MessageRepository messageRepository) {
        this.chatRepository = chatRepository;
        this.messageRepository = messageRepository;
        this.cache = null;
    }

    public ChatPlatformStatRepresentation get() {
        return cache;
    }

    @Scheduled(fixedDelay = 60 * 1000)
    public void updateCache() {
        // log.info("updating chat platform stat cache");
        cache = new ChatPlatformStatRepresentation(
                chatRepository.count(),
                messageRepository.count()
        );
    }
}
