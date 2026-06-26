package com.example.phantom.chat.chat;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.topic.globaltopic.GlobalTopicService;
import com.example.phantom.topic.globaltopic.GlobalTopicsAreReadyEvent;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@Slf4j
public class GlobalChatService {

    private final ChatRepository chatRepository;

    public GlobalChatService(ChatRepository chatRepository) {
        this.chatRepository = chatRepository;
    }

    public Chat find() {
        Chat chat = chatRepository.findById(GlobalChatConstants.ID).orElse(null);
        if (chat == null) {
            log.error("failed to find chat");
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }
        return chat;
    }

    @EventListener(GlobalTopicsAreReadyEvent.class)
    @Transactional
    public void create() {
        if (chatRepository.insertIfNotExists(GlobalChatConstants.ID, GlobalTopicService.AUTHORIZED_ID, ChatType.GROUP, "The Global Chat", Instant.now().getEpochSecond()) == 1) {
            log.info("global chat created");
        }
        else {
            log.info("global chat creation skipped: already exists");
        }
    }
}
