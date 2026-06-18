package com.example.phantom.notification.topic;

import com.example.phantom.notification.WsDestinations;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class TopicAccessService {

    private final TopicRepository topicRepository;
    private final UserRepository userRepository;

    public TopicAccessService(TopicRepository topicRepository, UserRepository userRepository) {
        this.topicRepository = topicRepository;
        this.userRepository = userRepository;
    }

    public boolean canRead(Long userId, String destination) {
        if (destination.startsWith(WsDestinations.USERS_PREFIX)) {
            return canReadUser(userId, destination);
        }
        if (destination.startsWith(WsDestinations.TOPIC_PREFIX)) {
            return canReadTopic(userId, destination);
        }
        return false;
    }

    private boolean canReadUser(Long userId, String destination) {
        return destination.equals(WsDestinations.user(userId));
    }

    private boolean canReadTopic(Long userId, String destination) {
        String topicId = destination.substring(WsDestinations.TOPIC_PREFIX.length());
        Topic topic = topicRepository.findById(topicId).orElse(null);
        User user = userRepository.findById(userId).orElse(null);
        if (topic == null || user == null) {
            return false;
        }

        // TODO TopicMember validation
        return (topic.getAllowAuthorized() ||
                (topic.getAllowChatModerators() && user.getRole().getChatModeratorAccess()) ||
                (topic.getAllowOwners() && user.getRole().getOwnerAccess()));
    }
}
