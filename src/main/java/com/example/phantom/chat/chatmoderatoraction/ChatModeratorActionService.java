package com.example.phantom.chat.chatmoderatoraction;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ChatModeratorActionService {

    private final ChatModeratorActionRepository chatModeratorActionRepository;

    public ChatModeratorActionService(ChatModeratorActionRepository chatModeratorActionRepository) {
        this.chatModeratorActionRepository = chatModeratorActionRepository;
    }

    public List<ChatModeratorActionRepresentation> get(Integer limit, Long before) {
        Pageable pageable = PageRequest.of(0, limit);

        List<ChatModeratorAction> actions = before != null
                ? chatModeratorActionRepository.findAllBeforeWithUsersPageable(before, pageable)
                : chatModeratorActionRepository.findAllWithUsersPageable(pageable);

        return actions.stream().map(ChatModeratorActionRepresentation::new).toList();
    }
}
