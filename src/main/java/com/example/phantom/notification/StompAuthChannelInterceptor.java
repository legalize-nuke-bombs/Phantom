package com.example.phantom.notification;

import com.example.phantom.jwt.JwtTokenProvider;
import com.example.phantom.notification.topic.TopicAccessService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;

@Component
@Slf4j
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtTokenProvider jwtTokenProvider;
    private final TopicAccessService topicAccessService;
    private final WebSocketSessionManager sessionManager;

    public StompAuthChannelInterceptor(JwtTokenProvider jwtTokenProvider, TopicAccessService topicAccessService,
                                       WebSocketSessionManager sessionManager) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.topicAccessService = topicAccessService;
        this.sessionManager = sessionManager;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            Long userId = resolveUserId(accessor.getFirstNativeHeader("Authorization"));
            if (userId == null) {
                log.info("rejected unauthorized connect attempt: userId is null");
                throw new MessagingException("unauthorized");
            }
            accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
            sessionManager.register(userId, accessor.getSessionId());
            log.info("user {} connected successful", userId);
        }
        else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            Long userId = currentUserId(accessor);
            if (userId == null) {
                log.info("rejected unauthorized subscribe attempt: userId is null");
                throw new MessagingException("unauthorized");
            }
            String destination = accessor.getDestination();
            if (destination == null || !topicAccessService.canReadWs(userId, destination)) {
                log.info("rejected unauthorized subscribe attempt: user {} does not have permission to read destination {}", userId, destination);
                return null; // not throwing exception to avoid killing websocket session
            }
            log.info("subscribe successful: user {} destination {}", userId, destination);
        }

        return message;
    }

    private Long resolveUserId(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return null;
        }
        return jwtTokenProvider.getUserIdFromToken(authorizationHeader.substring(7)).orElse(null);
    }

    private Long currentUserId(StompHeaderAccessor accessor) {
        Principal user = accessor.getUser();
        if (user == null) {
            return null;
        }
        try {
            return Long.valueOf(user.getName());
        }
        catch (NumberFormatException e) {
            return null;
        }
    }
}
