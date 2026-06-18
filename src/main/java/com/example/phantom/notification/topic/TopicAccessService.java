package com.example.phantom.notification.topic;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.WsDestinations;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

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
        log.info("access rejected: user {} destination {} is unknown", userId, destination);
        return false;
    }

    public boolean canReadUser(Long userId, String destinationUserId) {
        if (String.valueOf(userId).equals(destinationUserId)) {
            log.info("access granted: user {} destination user {}", userId, destinationUserId);
            return true;
        }
        log.info("access rejected: user {} destination user {}", userId, destinationUserId);
        return false;
    }

    public boolean canReadTopic(Long userId, String destinationTopicId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.info("access rejected: user {} not found", userId);
            return false;
        }
        if (topicRepository.findAccessibleTopicIds(
                user.getRole().getChatModeratorAccess(),
                user.getRole().getOwnerAccess(),
                userId,
                destinationTopicId
        ).isEmpty()) {
            log.info("access rejected: user {} does not have permission to read topic {}", userId, destinationTopicId);
            return false;
        }
        log.info("access granted: user {} topic {}", userId, destinationTopicId);
        return true;
    }
}
