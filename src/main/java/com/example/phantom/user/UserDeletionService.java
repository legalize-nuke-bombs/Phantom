package com.example.phantom.user;

import com.example.phantom.notification.topic.TopicAccessRevalidateService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class UserDeletionService {

    private final UserRepository userRepository;
    private final TopicAccessRevalidateService topicAccessRevalidateService;

    public UserDeletionService(UserRepository userRepository, TopicAccessRevalidateService topicAccessRevalidateService) {
        this.userRepository = userRepository;
        this.topicAccessRevalidateService = topicAccessRevalidateService;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void delete(User user) {
        Long userId = user.getId();
        userRepository.delete(user);
        topicAccessRevalidateService.revalidate(userId);
        log.info("delete done successful: goodbye, user {}", userId);
    }
}
