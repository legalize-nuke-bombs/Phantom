package com.example.phantom.notification.topic;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/topics")
public class TopicController {

    private final TopicAccessService topicAccessService;

    public TopicController(TopicAccessService topicAccessService) {
        this.topicAccessService = topicAccessService;
    }

    @GetMapping
    public List<String> getAccessible(@AuthenticationPrincipal Long userId) {
        return topicAccessService.getAccessible(userId);
    }
}
