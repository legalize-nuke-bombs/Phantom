package com.example.phantom.topic;

import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class TopicBuilderService {
    public Topic build(String id, boolean allowAuthorized, boolean allowChatModerators, boolean allowOwners, boolean allowCustomMembers) {
        Topic topic = new Topic();
        topic.setId(id);
        topic.setTimestamp(Instant.now().getEpochSecond());
        topic.setAllowAuthorized(allowAuthorized);
        topic.setAllowChatModerators(allowChatModerators);
        topic.setAllowOwners(allowOwners);
        topic.setAllowCustomMembers(allowCustomMembers);
        return topic;
    }
}
