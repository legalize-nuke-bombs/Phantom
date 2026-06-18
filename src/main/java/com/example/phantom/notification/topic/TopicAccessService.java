package com.example.phantom.notification.topic;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.WsDestinations;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

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

    public List<String> getAccessible(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        return topicRepository.findAccessibleTopicIds(
                user.getRole().getChatModeratorAccess(),
                user.getRole().getOwnerAccess(),
                null
        );
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
                topicId
        ).isEmpty();
    }
}
