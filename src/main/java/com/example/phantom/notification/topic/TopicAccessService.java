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

    public boolean canRead(Long userId, String destination) {
        if (canReadQuiet(userId, destination)) {
            log.info("access granted: user {} destination {}", userId, destination);
            return true;
        }
        log.info("access rejected: user {} destination {}", userId, destination);
        return false;
    }

    private boolean canReadQuiet(Long userId, String destination) {
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
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return false;
        }
        return !topicRepository.findAccessibleTopicIds(
                user.getRole().getChatModeratorAccess(),
                user.getRole().getOwnerAccess(),
                userId,
                topicId
        ).isEmpty();
    }
}
