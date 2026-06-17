package com.example.phantom.notification.topic.globaltopic;

import com.example.phantom.notification.topic.Topic;
import com.example.phantom.notification.topic.TopicBuilderService;
import com.example.phantom.notification.topic.TopicRepository;
import com.example.phantom.user.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class GlobalTopicInitService {

    private final TopicRepository topicRepository;
    private final TopicBuilderService topicBuilderService;

    public GlobalTopicInitService(TopicRepository topicRepository, TopicBuilderService topicBuilderService) {
        this.topicRepository = topicRepository;
        this.topicBuilderService = topicBuilderService;
    }

    @EventListener(ApplicationStartedEvent.class)
    public void create() {
        createTopic("authorized", true, false, false);
        createTopic("chat-moderators", false, true, false);
        createTopic("owners", false, false, true);
    }

    private void createTopic(String id, boolean allowAuthorized, boolean allowChatModerators, boolean allowOwners) {
        try {
            Topic topic = topicBuilderService.build(id, allowAuthorized, allowChatModerators, allowOwners, false);
            topicRepository.save(topic);
            log.info("topic {} created", id);
        }
        catch (DataIntegrityViolationException e) {
            log.info("topic {} was already created", id);
        }
    }
}
