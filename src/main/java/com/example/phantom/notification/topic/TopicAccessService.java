package com.example.phantom.notification.topic;

import com.example.phantom.notification.WsDestinations;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class TopicAccessService {

    private final UserRepository userRepository;
    private final TopicRepository topicRepository;

    public TopicAccessService(UserRepository userRepository, TopicRepository topicRepository) {
        this.userRepository = userRepository;
        this.topicRepository = topicRepository;
    }

    public boolean canReadWs(Long userId, String destination) {
        if (destination.startsWith(WsDestinations.USERS_PREFIX)) {
            return canReadUser(userId, destination.substring(WsDestinations.USERS_PREFIX.length()));
        }
        if (destination.startsWith(WsDestinations.TOPIC_PREFIX)) {
            return canReadTopic(userId, destination.substring(WsDestinations.TOPIC_PREFIX.length()));
        }
        return false;
    }

    public boolean canReadUser(Long userId, String destinationUserId) {
        return String.valueOf(userId).equals(destinationUserId);
    }

    public boolean canReadTopic(Long userId, String destinationTopicId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return false;
        }
        return !topicRepository.findAccessibleTopicIds(
                user.getRole().getChatModeratorAccess(),
                user.getRole().getOwnerAccess(),
                userId,
                destinationTopicId,
                null, null
        ).isEmpty();
    }
}
