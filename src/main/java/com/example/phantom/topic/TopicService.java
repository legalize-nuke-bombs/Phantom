package com.example.phantom.topic;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TopicService {

    private final UserRepository userRepository;
    private final TopicRepository topicRepository;
    private final RateLimitService rateLimitService;

    public TopicService(UserRepository userRepository, TopicRepository topicRepository, RateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.topicRepository = topicRepository;
        this.rateLimitService = rateLimitService;
    }

    public List<String> get(Long userId, Integer limit, String before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        rateLimitService.startAction(userId, RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        return topicRepository.findAccessibleTopicIds(
                user.getRole().getChatModeratorAccess(),
                user.getRole().getOwnerAccess(),
                userId,
                null,
                before,
                pageable
        );
    }

    public List<String> get(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        return topicRepository.findAccessibleTopicIds(
                user.getRole().getChatModeratorAccess(),
                user.getRole().getOwnerAccess(),
                user.getId(),
                null,
                null, null
        );
    }
}
