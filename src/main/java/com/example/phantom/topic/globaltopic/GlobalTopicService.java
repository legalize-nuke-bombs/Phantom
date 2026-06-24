package com.example.phantom.topic.globaltopic;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.topic.Topic;
import com.example.phantom.topic.TopicBuilderService;
import com.example.phantom.topic.TopicRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class GlobalTopicService {

    private final TopicRepository topicRepository;
    private final TopicBuilderService topicBuilderService;
    private final ApplicationEventPublisher applicationEventPublisher;

    public GlobalTopicService(TopicRepository topicRepository, TopicBuilderService topicBuilderService, ApplicationEventPublisher applicationEventPublisher) {
        this.topicRepository = topicRepository;
        this.topicBuilderService = topicBuilderService;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    public Topic findAuthorized() {
        return findTopic("authorized");
    }

    public Topic findChatModerators() {
        return findTopic("chat-moderators");
    }

    public Topic findOwners() {
        return findTopic("owners");
    }

    private Topic findTopic(String id) {
        Topic topic = topicRepository.findById(id).orElse(null);
        if (topic == null) {
            log.error("failed to find topic {}", id);
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        }
        return topic;
    }

    @EventListener(ApplicationStartedEvent.class)
    public void create() {
        createTopic("authorized", true, false, false);
        createTopic("chat-moderators", false, true, false);
        createTopic("owners", false, false, true);
        applicationEventPublisher.publishEvent(new GlobalTopicsAreReadyEvent());
    }

    private void createTopic(String id, boolean allowAuthorized, boolean allowChatModerators, boolean allowOwners) {
        if (topicRepository.findById(id).isEmpty()) {
            Topic topic = topicBuilderService.build(id, allowAuthorized, allowChatModerators, allowOwners, false);
            topicRepository.save(topic);
            log.info("topic {} created", id);
        }
        else {
            log.info("topic {} creation skipped : already exists", id);
        }
    }
}
