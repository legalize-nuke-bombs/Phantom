package com.example.phantom.user;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class UserStatService {

    private final UserRepository userRepository;
    private volatile UserStatRepresentation cache;

    public UserStatService(UserRepository userRepository) {
        this.userRepository = userRepository;
        this.cache = null;
    }

    public UserStatRepresentation get() {
        return cache;
    }

    @Scheduled(fixedDelay = 10 * 1000)
    public void updateCache() {
        long since24h = Instant.now().minus(Duration.ofHours(24)).getEpochSecond();
        cache = new UserStatRepresentation(
                userRepository.countAll(),
                userRepository.countSince(since24h)
        );
    }

}
