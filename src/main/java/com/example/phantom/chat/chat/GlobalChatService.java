package com.example.phantom.chat.chat;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.topic.globaltopic.GlobalTopicService;
import com.example.phantom.topic.globaltopic.GlobalTopicsAreReadyEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class GlobalChatService {

    private final ChatRepository chatRepository;
    private final GlobalTopicService globalTopicService;

    public GlobalChatService(ChatRepository chatRepository, GlobalTopicService globalTopicService) {
        this.chatRepository = chatRepository;
        this.globalTopicService = globalTopicService;
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
    public void create() {
        if (chatRepository.findById(GlobalChatConstants.ID).isEmpty()) {
            Chat chat = new Chat();
            chat.setId(GlobalChatConstants.ID);
            chat.setTopic(globalTopicService.findAuthorized());
            chatRepository.save(chat);
            log.info("chat created");
        }
        else {
            log.info("chat creation skipped: already exists");
        }
    }
}
