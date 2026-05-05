package com.example.phantom.chat.banlist;

import com.example.phantom.chat.chatmoderatoraction.ChatModeratorAction;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionRepository;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

@Service
public class BanlistService {

    private final UserRepository userRepository;
    private final BanRepository banRepository;
    private final ChatModeratorActionRepository chatModeratorActionRepository;

    public BanlistService(UserRepository userRepository, BanRepository banRepository, ChatModeratorActionRepository chatModeratorActionRepository) {
        this.userRepository = userRepository;
        this.banRepository = banRepository;
        this.chatModeratorActionRepository = chatModeratorActionRepository;
    }

    public BanRepresentation getById(Long userId) {
        Ban ban = banRepository.findById(userId).orElseThrow(() -> new BadRequestException("user is not banned"));
        if (!ban.isActive()) {
            throw new BadRequestException("user is not banned");
        }
        return new BanRepresentation(ban);
    }

    @Transactional
    public Map<String, String> ban(Long userId, Long targetId, BanRequest request) {
        User user = getChatModerator(userId);

        String reason = request.getReason();
        Long duration = request.getDuration();

        User target = userRepository.findById(targetId).orElseThrow(() -> new NotFoundException("target not found"));

        if (Objects.equals(userId, target.getId())) {
            throw new BadRequestException("can't ban yourself");
        }

        if (target.getRole().chatModeratorAccess()) {
            throw new ForbiddenException("can't ban chat moderator");
        }

        Ban ban = banRepository.findById(target.getId()).orElse(null);
        if (ban != null && ban.isActive()) {
            throw new BadRequestException("target is already banned");
        }

        Long now = Instant.now().getEpochSecond();

        ban = new Ban();
        ban.setUser(target);
        ban.setTimestamp(now);
        ban.setModerator(user);
        ban.setDuration(duration);
        ban.setReason(reason);
        banRepository.save(ban);

        ChatModeratorAction chatModeratorAction = new ChatModeratorAction();
        chatModeratorAction.setUser(user);
        chatModeratorAction.setTimestamp(now);
        chatModeratorAction.setAction("ban");
        chatModeratorAction.setData(Map.of(
                "user_id", String.valueOf(targetId),
                "reason", reason,
                "duration", String.valueOf(duration)
        ));
        chatModeratorActionRepository.save(chatModeratorAction);

        return Map.of("message", "banned");
    }

    @Transactional
    public void unban(Long userId, Long targetId, UnbanRequest request) {
        User user = getChatModerator(userId);

        String reason = request.getReason();

        if (!userRepository.existsById(targetId)) {
            throw new NotFoundException("target not found");
        }

        Ban ban = banRepository.findById(targetId).orElseThrow(() -> new BadRequestException("target not banned"));

        ChatModeratorAction chatModeratorAction = new ChatModeratorAction();
        chatModeratorAction.setUser(user);
        chatModeratorAction.setTimestamp(Instant.now().getEpochSecond());
        chatModeratorAction.setAction("unban");
        chatModeratorAction.setData(Map.of(
                "user_id", String.valueOf(targetId),
                "reason", reason,
                "ban_moderator_id", ban.getModerator() != null ? String.valueOf(ban.getModerator().getId()) : "DELETED",
                "ban_timestamp", String.valueOf(ban.getTimestamp()),
                "ban_reason", ban.getReason(),
                "ban_duration", String.valueOf(ban.getDuration())
        ));
        chatModeratorActionRepository.save(chatModeratorAction);

        banRepository.delete(ban);
    }

    private User getChatModerator(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        if (!user.getRole().chatModeratorAccess()) {
            throw new ForbiddenException("you don't have permission to ban users");
        }
        return user;
    }
}
